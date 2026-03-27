const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { convertTime } = require("../../utils/convert.js");
const EMOJIS = require("../../utils/emoji.json");

const EMBED_COLOR = "#ff0051";

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
      const suppressUntil = typeof player.get === "function" ? player.get("suppressUntil") : null;
      if (suppressUntil && Date.now() < suppressUntil) {
        await new Promise((resolve) => setTimeout(resolve, suppressUntil - Date.now()));
      }
    } catch (e) {}

    try {
      if (typeof player.set === "function") {
        player.set("suppressQueueEndNoticeUntil", null);
      }
    } catch (_e) {}

    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel) {
      client.logger?.log(
        `Channel not found for textChannelId: ${player.textChannelId} in guild ${player.guildId}`,
        "error"
      );
      return;
    }

    const title = track?.info?.title || track?.title || "Unknown";
    const uri = track?.info?.uri || track?.uri || "";
    const duration = track?.info?.duration || track?.duration || 0;
    const isStream = track?.info?.isStream || track?.isStream || false;

    const oldMsg = typeof player.get === "function" ? player.get("playingsongmsg") : null;

    const prevBtn = new ButtonBuilder()
      .setCustomId("music_prevtrack")
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Prev");

    const pauseBtn = new ButtonBuilder()
      .setCustomId("music_prtrack")
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Pause");

    const skipBtn = new ButtonBuilder()
      .setCustomId("music_skiptrack")
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Skip");

    const shuffleBtn = new ButtonBuilder()
      .setCustomId("music_shufflequeue")
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Shuffle");

    const queueBtn = new ButtonBuilder()
      .setCustomId("music_showqueue")
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Queue");

    const stopBtn = new ButtonBuilder()
      .setCustomId("music_stop")
      .setStyle(ButtonStyle.Danger)
      .setLabel("Stop");

    const primaryRow = new ActionRowBuilder().addComponents(prevBtn, pauseBtn, skipBtn, shuffleBtn, queueBtn);
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
        name:  "Now Playing",
        iconURL: client.user.displayAvatarURL({ forceStatic: false })
      })
      .setThumbnail(thumbnail)
      .setDescription(
        `${songLine}\n\`${isStream ? "LIVE" : convertTime(duration)}\` - Requested by ${requestedBy}`
      );
      

    let msg = null;
    const oldMessageChannelId = oldMsg?.channelId || oldMsg?.channel?.id || null;

    if (oldMsg && typeof oldMsg.edit === "function" && (!oldMessageChannelId || oldMessageChannelId === channel.id)) {
      msg = await oldMsg.edit({ embeds: [embed], components: [primaryRow, secondaryRow] }).catch(() => null);
    }

    if (!msg) {
      msg = await channel.send({ embeds: [embed], components: [primaryRow, secondaryRow] }).catch(async (error) => {
        client.logger?.log(`Failed to send track start embed in guild ${player.guildId}: ${error.message}`, "error");
        return channel.send(`${EMOJIS.music || "[M]"} Now Playing: ${title}`).catch(() => null);
      });
    }

    if (!msg) {
      client.logger?.log(`Track start message failed to send in guild ${player.guildId}`, "error");
      return;
    }

    if (typeof player.set === "function") {
      player.set("playingsongmsg", msg);
      player.set("lastTrack", track);
    }
  } catch (error) {
    client.logger?.log(`[ERROR] trackStart: ${error.message}`, "error");
  }
};
