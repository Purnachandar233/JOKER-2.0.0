const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { convertTime } = require("../../utils/convert.js");
const EMOJIS = require("../../utils/emoji.json");

const EMBED_COLOR = "#ff0051";

function resolveComponentEmoji(value, fallback = null) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  const customMatch = raw.match(/^<(?<animated>a)?:(?<name>[A-Za-z0-9_]+):(?<id>\d+)>$/);
  if (customMatch?.groups?.id) {
    return {
      id: customMatch.groups.id,
      name: customMatch.groups.name || null,
      animated: Boolean(customMatch.groups.animated),
    };
  }

  return raw;
}

function resolveRuntimeEmoji(client, value, fallback = null) {
  const resolved = resolveComponentEmoji(value, fallback);
  if (!resolved) return null;

  if (typeof resolved === "object" && resolved.id) {
    const availableEmoji =
      client?.emojis?.cache?.get?.(resolved.id) ||
      client?.emojis?.resolve?.(resolved.id) ||
      null;

    if (!availableEmoji) {
      return fallback || null;
    }
  }

  return resolved;
}

function createEmojiButton({
  client,
  customId,
  label,
  style,
  emoji,
  fallbackEmoji,
}) {
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setStyle(style);

  if (typeof label === "string" && label.trim().length) {
    button.setLabel(label.trim());
  }

  const resolvedEmoji = resolveRuntimeEmoji(client, emoji, fallbackEmoji);
  if (resolvedEmoji) {
    try {
      button.setEmoji(resolvedEmoji);
    } catch (_err) {}
  }

  return button;
}

async function resolveTextChannel(client, channelId, fallbackChannelId = null) {
  const targetChannelId = channelId || fallbackChannelId || null;
  if (!targetChannelId) return null;

  const cached = client.channels.cache.get(targetChannelId);
  if (cached) return cached;

  if (typeof client.channels?.fetch === "function") {
    return client.channels.fetch(targetChannelId).catch(() => null);
  }

  return null;
}

module.exports = async (client, player, track) => {
  try {
    const queueTools = client?.core?.queue || {};
    const getRequesterInfo = typeof queueTools.getRequesterInfo === "function"
      ? queueTools.getRequesterInfo
      : (() => ({ mention: null, tag: "Unknown" }));
    const getTrackThumbnail = typeof queueTools.getTrackThumbnail === "function"
      ? queueTools.getTrackThumbnail
      : (() => null);

    try {
      const idleLeaveTimer = client.__queueEndLeaveTimers?.get?.(player.guildId);
      if (idleLeaveTimer) {
        clearTimeout(idleLeaveTimer);
        client.__queueEndLeaveTimers.delete(player.guildId);
      }
    } catch (_err) {}

    try {
      const internalQueueEmptyTimer = typeof player.get === "function" ? player.get("internal_queueempty") : null;
      if (internalQueueEmptyTimer) {
        clearTimeout(internalQueueEmptyTimer);
        player.set("internal_queueempty", null);
      }
    } catch (_err) {}

    try {
      const suppressUntil = typeof player.get === "function" ? player.get("suppressUntil") : null;
      if (suppressUntil && Date.now() < suppressUntil) {
        await new Promise((resolve) => setTimeout(resolve, suppressUntil - Date.now()));
      }
    } catch (_err) {}

    try {
      if (typeof player.set === "function") {
        player.set("suppressQueueEndNoticeUntil", null);
      }
    } catch (_err) {}

    const channel = await resolveTextChannel(client, player.textChannelId, player?.options?.textChannelId);
    if (!channel) {
      client.logger?.log(
        `Channel not found for textChannelId: ${player.textChannelId} in guild ${player.guildId}`,
        "warn"
      );
      return;
    }

    const title = track?.info?.title || track?.title || "Unknown";
    const uri = track?.info?.uri || track?.uri || "";
    const duration = track?.info?.duration || track?.duration || 0;
    const isStream = track?.info?.isStream || track?.isStream || false;

    const oldMsg = typeof player.get === "function" ? player.get("playingsongmsg") : null;

    const prevBtn = createEmojiButton({
      client,
      customId: "music_prevtrack",
      style: ButtonStyle.Secondary,
      emoji: EMOJIS.prev,
      fallbackEmoji: "\u23EE\uFE0F",
    });

    const pauseBtn = createEmojiButton({
      client,
      customId: "music_prtrack",
      style: ButtonStyle.Secondary,
      emoji: EMOJIS.pause,
      fallbackEmoji: "\u23F8\uFE0F",
    });

    const skipBtn = createEmojiButton({
      client,
      customId: "music_skiptrack",
      style: ButtonStyle.Secondary,
      emoji: EMOJIS.skip,
      fallbackEmoji: "\u23ED\uFE0F",
    });

    const queueBtn = createEmojiButton({
      client,
      customId: "music_showqueue",
      style: ButtonStyle.Secondary,
      emoji: EMOJIS.queue,
      fallbackEmoji: "\u{1F4C3}",
    });

    const stopBtn = createEmojiButton({
      client,
      customId: "music_stop",
      style: ButtonStyle.Secondary,
      emoji: EMOJIS.stop,
      fallbackEmoji: "\u23F9\uFE0F",
    });

    const primaryRow = new ActionRowBuilder().addComponents(prevBtn, pauseBtn, skipBtn, queueBtn);
    const secondaryRow = new ActionRowBuilder().addComponents(stopBtn);

    const songLine = uri ? `**[${title}](${uri})**` : `**${title}**`;
    const playerRequester = typeof player.get === "function" ? player.get("requester") : null;
    const playerRequesterId = typeof player.get === "function" ? player.get("requesterId") : null;

    const requester = getRequesterInfo(track, {
      fallbackRequester: playerRequester,
      fallbackRequesterId: playerRequesterId,
      fallbackTag: null,
    });
    const requestedBy = requester.mention || `\`${requester.tag}\``;
    const thumbnail = getTrackThumbnail(track);

    const embed = new EmbedBuilder()
      .setColor(client?.embedColor || EMBED_COLOR)
      .setAuthor({
        name: "Now Playing",
        iconURL: client.user.displayAvatarURL({ forceStatic: false }),
      })
      .setThumbnail(thumbnail)
      .setDescription(
        `${songLine}\n\`${isStream ? "LIVE" : convertTime(duration)}\n\`Requested by ${requestedBy}`
      );

    const previousMessageId = oldMsg?.id || null;
    const msg = await channel.send({ embeds: [embed], components: [primaryRow, secondaryRow] }).catch(async (error) => {
      client.logger?.log(`Failed to send track start embed in guild ${player.guildId}: ${error.message}`, "error");
      return channel.send(`${EMOJIS.music || "[M]"} Now Playing: ${title}`).catch(() => null);
    });

    if (!msg) {
      client.logger?.log(`Track start message failed to send in guild ${player.guildId}`, "error");
      return;
    }

    if (oldMsg && previousMessageId !== msg.id && typeof oldMsg.delete === "function") {
      await oldMsg.delete().catch(() => {});
    }

    if (typeof player.set === "function") {
      player.set("playingsongmsg", msg);
      player.set("lastTrack", track);
    }
  } catch (error) {
    client.logger?.log(`[ERROR] trackStart: ${error.message}`, "error");
  }
};
