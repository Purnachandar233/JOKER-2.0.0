const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  TextDisplayBuilder,
} = require("discord.js");
const EMBED_COLOR = "#ff0051";

const EMOJIS = require("../../utils/emoji.json");
const twentyfourseven = require("../../schema/twentyfourseven");
const { resolvePremiumAccess } = require("../../utils/premiumAccess");

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const IDLE_LEAVE_DELAY_MS = toPositiveNumber(process.env.QUEUE_END_IDLE_LEAVE_MS, 2 * 60 * 1000);
const IDLE_LEAVE_MINUTES = Math.max(1, Math.round(IDLE_LEAVE_DELAY_MS / 60_000));
const IDLE_LEAVE_LABEL = `${IDLE_LEAVE_MINUTES} minute${IDLE_LEAVE_MINUTES === 1 ? "" : "s"}`;
const QUEUE_END_AD_COOLDOWN_MS = toPositiveNumber(
  process.env.QUEUE_END_AD_COOLDOWN_MS || process.env.QUEUE_END_PREMIUM_NUDGE_COOLDOWN_MS,
  24 * 60 * 60 * 1000
);
const QUEUE_END_AD_CACHE_MAX = toPositiveNumber(
  process.env.QUEUE_END_AD_CACHE_MAX || process.env.QUEUE_END_PREMIUM_NUDGE_CACHE_MAX,
  5000
);
const LOG_QUEUE_EVENTS = String(process.env.LOG_QUEUE_EVENTS || "false").toLowerCase() === "true";

function resolveAccentColor(color) {
  if (typeof color === "number" && Number.isFinite(color)) return color;
  const parsed = parseInt(String(color || "").replace(/^#/, ""), 16);
  return Number.isFinite(parsed) ? parsed : 0xff0051;
}

function logQueueEvent(client, message, level = "info") {
  if (!LOG_QUEUE_EVENTS) return;
  try {
    client.logger?.log?.(message, level);
  } catch (_err) {}
}

async function resolveTextChannel(client, channelId) {
  if (!channelId) return null;

  const cached = client.channels.cache.get(channelId);
  if (cached) return cached;

  if (typeof client.channels?.fetch === "function") {
    return client.channels.fetch(channelId).catch(() => null);
  }

  return null;
}

async function resolveVoiceChannel(client, player) {
  const guild = client.guilds.cache.get(player.guildId);
  const voiceChannelId =
    guild?.members?.me?.voice?.channelId ||
    player.voiceChannelId ||
    null;

  if (!voiceChannelId) return null;

  const cached = client.channels.cache.get(voiceChannelId);
  if (cached) return cached;

  if (typeof client.channels?.fetch === "function") {
    return client.channels.fetch(voiceChannelId).catch(() => null);
  }

  return null;
}

function getHumanListenerCount(client, player, voiceChannel) {
  const guild = client.guilds.cache.get(player.guildId);
  const voiceChannelId = voiceChannel?.id || player.voiceChannelId || guild?.members?.me?.voice?.channelId || null;
  if (!guild || !voiceChannelId) return 0;

  const voiceStates = guild.voiceStates?.cache;
  if (voiceStates?.size) {
    const humansFromVoiceStates = voiceStates.filter(
      (state) => state.channelId === voiceChannelId && !state.member?.user?.bot
    ).size;

    if (humansFromVoiceStates > 0) return humansFromVoiceStates;
  }

  const memberCollection = voiceChannel?.members;
  if (memberCollection?.size) {
    return memberCollection.filter((member) => !member.user?.bot).size;
  }

  return 0;
}

function clearIdleLeaveTimer(client, guildId) {
  const timers = client.__queueEndLeaveTimers;
  if (!timers) return;

  const existingTimer = timers.get(guildId);
  if (!existingTimer) return;

  clearTimeout(existingTimer);
  timers.delete(guildId);
}

function pruneQueueEndAdCooldown(client, now = Date.now()) {
  const cooldownMap = client.__queueEndAdCooldown;
  if (!(cooldownMap instanceof Map)) return;

  for (const [guildId, lastSentAt] of cooldownMap.entries()) {
    const raw = Number(lastSentAt || 0);
    if (!Number.isFinite(raw) || raw <= 0 || (now - raw) >= QUEUE_END_AD_COOLDOWN_MS) {
      cooldownMap.delete(guildId);
    }
  }

  if (cooldownMap.size <= QUEUE_END_AD_CACHE_MAX) return;

  const overflow = cooldownMap.size - QUEUE_END_AD_CACHE_MAX;
  let removed = 0;
  for (const guildId of cooldownMap.keys()) {
    cooldownMap.delete(guildId);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function playerHasActiveQueue(player) {
  const hasCurrentTrack = Boolean(player?.queue?.current);
  const hasUpcomingTracks = Array.isArray(player?.queue?.tracks) && player.queue.tracks.length > 0;
  const isPlaying = Boolean(player?.playing);
  const isPausedWithTrack = Boolean(player?.paused) && hasCurrentTrack;

  return (
    hasCurrentTrack ||
    isPlaying ||
    isPausedWithTrack ||
    hasUpcomingTracks
  );
}

function getRequesterId(player, track) {
  const trackRequester = track?.requester;
  const requesterFromTrack =
    trackRequester?.id ||
    trackRequester?.user?.id ||
    track?.info?.requester?.id ||
    (typeof trackRequester === "string" ? trackRequester : null);
  if (requesterFromTrack) return String(requesterFromTrack);

  const storedRequester = typeof player?.get === "function" ? player.get("requester") : null;
  if (typeof storedRequester === "string" && storedRequester.trim()) return storedRequester;

  const requesterFromStored =
    storedRequester?.id ||
    storedRequester?.user?.id ||
    null;
  if (requesterFromStored) return String(requesterFromStored);

  const requesterId = typeof player?.get === "function" ? player.get("requesterId") : null;
  return requesterId ? String(requesterId) : null;
}

function hasQueueEndAdCooldown(client, guildId, now = Date.now()) {
  const cooldownMap = client.__queueEndAdCooldown;
  if (!cooldownMap) return false;
  pruneQueueEndAdCooldown(client, now);

  const lastSentAt = Number(cooldownMap.get(guildId) || 0);
  if (!Number.isFinite(lastSentAt) || lastSentAt <= 0) {
    cooldownMap.delete(guildId);
    return false;
  }

  if ((now - lastSentAt) >= QUEUE_END_AD_COOLDOWN_MS) {
    cooldownMap.delete(guildId);
    return false;
  }

  return true;
}

function markQueueEndAdSent(client, guildId, now = Date.now()) {
  if (!client.__queueEndAdCooldown) {
    client.__queueEndAdCooldown = new Map();
  }

  pruneQueueEndAdCooldown(client, now);
  client.__queueEndAdCooldown.set(guildId, now);
}

async function getQueueEndAdOffer(client, player, track) {
  const now = Date.now();
  if (hasQueueEndAdCooldown(client, player.guildId, now)) {
    return null;
  }

  const requesterId = getRequesterId(player, track);
  let premiumAccess = {
    userPremium: false,
    guildPremium: false,
    hasAccess: false,
  };

  try {
    premiumAccess = await resolvePremiumAccess(requesterId, player.guildId, client);
  } catch (error) {
    logQueueEvent(
      client,
      `Queue-end offer access check failed in guild ${player.guildId}: ${error?.message || error}`,
      "warn"
    );
  }

  if (premiumAccess?.hasAccess || premiumAccess?.userPremium || premiumAccess?.guildPremium) {
    return null;
  }

  return {
    voteUrl: `https://top.gg/bot/${client.user.id}/vote`,
    premiumUrl: `https://top.gg/bot/${client.user.id}`,
    supportUrl: client?.legalLinks?.supportServerUrl || "https://discord.gg/JQzBqgmwFm",
    checkedAt: now,
  };
}

function buildQueueEndFallbackEmbed(client, offer = null) {
  const embed = new EmbedBuilder()
    .setColor(client?.embedColor || EMBED_COLOR)
    .setAuthor({ name: "Queue empty!", iconURL: client.user.displayAvatarURL() })
    .setDescription(
      "Add more songs, enable autoplay, or turn on 24/7 mode if you want me to stay connected after the queue ends."
    );

  if (offer) {
    embed.addFields(
      {
        name: "Vote",
        value: "Vote on Top.gg to unlock temporary premium access for 12 hours.",
        inline: true,
      },
      {
        name: "Premium",
        value: "Premium unlocks extra commands and lets you use features like autoplay or 24/7 mode.",
        inline: true,
      }
    );
  }

  return embed;
}

function buildQueueEndActionRow(client, offer) {
  if (!offer) return null;

  const voteButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Vote")
    .setURL(offer.voteUrl);

  const premiumButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Premium")
    .setURL(offer.premiumUrl);

  const supportButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Support")
    .setURL(offer.supportUrl);

  try {
    if (EMOJIS.vote) voteButton.setEmoji(EMOJIS.vote);
  } catch (_e) {}
  try {
    if (EMOJIS.premium || EMOJIS.vip) premiumButton.setEmoji(EMOJIS.premium || EMOJIS.vip);
  } catch (_e) {}
  try {
    if (EMOJIS.support) supportButton.setEmoji(EMOJIS.support);
  } catch (_e) {}

  return new ActionRowBuilder().addComponents(voteButton, premiumButton, supportButton);
}

function buildQueueEndV2Container(client, offer = null) {
  const container = new ContainerBuilder()
    .setAccentColor(resolveAccentColor(client?.embedColor || EMBED_COLOR))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Queue Empty"),
      new TextDisplayBuilder().setContent(
        "Add more songs, enable autoplay, or turn on 24/7 mode if you want me to stay connected after the queue ends."
      )
    );

  if (offer) {
    const row = buildQueueEndActionRow(client, offer);
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("### Want More Perks?"),
        new TextDisplayBuilder().setContent(
          "Vote for temporary premium access or review premium information below. This promo is shown only sometimes after queue end."
        )
      );

    if (row) {
      container.addActionRowComponents(row);
    }
  }

  return container;
}

async function sendQueueEndNotice(client, player, textChannel, offer = null) {
  if (!textChannel) return false;

  try {
    await textChannel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [buildQueueEndV2Container(client, offer)],
    });
    if (offer) markQueueEndAdSent(client, player.guildId, offer.checkedAt || Date.now());
    return true;
  } catch (_v2Err) {
    const fallbackEmbed = buildQueueEndFallbackEmbed(client, offer);
    const actionRow = buildQueueEndActionRow(client, offer);

    try {
      const payload = { embeds: [fallbackEmbed] };
      if (actionRow) payload.components = [actionRow];
      await textChannel.send(payload);
      if (offer) markQueueEndAdSent(client, player.guildId, offer.checkedAt || Date.now());
      return true;
    } catch (plainErr) {
      logQueueEvent(
        client,
        `Queue-end notice send failed in guild ${player.guildId}: ${plainErr?.message || plainErr}`,
        "warn"
      );
      return false;
    }
  }
}

function buildQueueLeaveEmbed(client) {
  return new EmbedBuilder()
    .setColor(client?.embedColor || EMBED_COLOR)
    .setAuthor({ name: "Leaving Voice Channel!", iconURL: client.user.displayAvatarURL() })
    .setDescription(`Since ${IDLE_LEAVE_LABEL} nobody is listening, I've left the voice channel. Want the bot to stay in your channel all the time? Use the /247 command!`);
}

async function sendQueueLeaveNotice(client, player, fallbackChannel = null) {
  const leaveEmbed = buildQueueLeaveEmbed(client);
  const textChannel = (await resolveTextChannel(client, player.textChannelId)) || fallbackChannel;

  if (!textChannel) {
    logQueueEvent(client,
      `Queue-end auto-leave notice failed in guild ${player.guildId}: text channel ${player.textChannelId} not found.`,
      "warn");
    return false;
  }

  try {
    await textChannel.send({ embeds: [leaveEmbed] });
    return true;
  } catch (_embedErr) {
    try {
      await textChannel.send(`Leaving voice channel: queue ended, 24/7 is off, and no listeners stayed for ${IDLE_LEAVE_LABEL}.`);
      return true;
    } catch (plainErr) {
      logQueueEvent(client,
        `Queue-end auto-leave notice send failed in guild ${player.guildId}: ${plainErr?.message || plainErr}`,
        "warn");
      return false;
    }
  }
}

module.exports = async (client, player, track, payload) => {
  const queueEndReason = payload?.reason || payload?.type || "unknown";

  logQueueEvent(client,
    `Queue ended in guild ${player.guildId} (reason=${queueEndReason}).`,
    "warn");

  clearIdleLeaveTimer(client, player.guildId);

  const channel = await resolveTextChannel(client, player.textChannelId);

  if (player.get("playingsongmsg")) {
    player.get("playingsongmsg").delete().catch(() => {});
  }

  const suppressQueueEndUntil = Number(player.get("suppressQueueEndNoticeUntil") || 0);
  const suppressQueueEndNotice = suppressQueueEndUntil > Date.now();

  const isAutoplayEnabled = player.get && player.get("autoplay") === true;
  if (isAutoplayEnabled) return;

  let is247Enabled = false;

  try {
    const doc = await twentyfourseven.findOne({ guildID: player.guildId });
    is247Enabled = Boolean(doc);
  } catch (err) {
    client.logger?.log?.(`Failed to read 24/7 setting for guild ${player.guildId}: ${err?.message || err}`, "warn");
  }

  if (!suppressQueueEndNotice && channel) {
    const offer = !is247Enabled
      ? await getQueueEndAdOffer(client, player, track).catch(() => null)
      : null;
    await sendQueueEndNotice(client, player, channel, offer).catch(() => {});
  }

  if (is247Enabled) return;

  if (!client.__queueEndLeaveTimers) {
    client.__queueEndLeaveTimers = new Map();
  }

  const idleLeaveTimer = setTimeout(async () => {
    clearIdleLeaveTimer(client, player.guildId);

    try {
      const activePlayer = client.lavalink?.players?.get(player.guildId);
      if (!activePlayer || activePlayer !== player) return;
      if (playerHasActiveQueue(player)) return;

      const autoplayStillEnabled = player.get && player.get("autoplay") === true;
      if (autoplayStillEnabled) return;

      const keepConnected247 = await twentyfourseven.findOne({ guildID: player.guildId }).catch(() => null);
      if (keepConnected247) return;

      const voiceChannel = await resolveVoiceChannel(client, player);

      if (!voiceChannel) {
        logQueueEvent(client, `Queue-end auto-leave in guild ${player.guildId}: voice channel missing.`, "warn");
        await sendQueueLeaveNotice(client, player, channel);
        await player.destroy().catch(() => {});
        return;
      }

      const humanListenerCount = getHumanListenerCount(client, player, voiceChannel);
      if (humanListenerCount > 0) {
        logQueueEvent(client,
          `Queue-end auto-leave cancelled in guild ${player.guildId}: ${humanListenerCount} listener(s) still present.`,
          "info");
        return;
      }

      await sendQueueLeaveNotice(client, player, channel);

      const keysToClear = ["autoplay", "requester", "identifier", "playingsongmsg", "suppressUntil", "suppressQueueEndNoticeUntil"];
      for (const key of keysToClear) {
        try {
          if (player && typeof player.set === "function") player.set(key, null);
        } catch (_err) {}
      }

      await player.destroy().catch(() => {});
    } catch (err) {
      client.logger?.log?.(`Idle queue-end leave failed for guild ${player.guildId}: ${err?.message || err}`, "error");
    }
  }, IDLE_LEAVE_DELAY_MS);
  if (typeof idleLeaveTimer.unref === "function") {
    idleLeaveTimer.unref();
  }

  client.__queueEndLeaveTimers.set(player.guildId, idleLeaveTimer);
};
