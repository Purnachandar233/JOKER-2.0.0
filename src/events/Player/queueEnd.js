const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const EMBED_COLOR = "#ff0051";

const EMOJIS = require("../../utils/emoji.json");
const twentyfourseven = require("../../schema/twentyfourseven");
const Premium = require("../../schema/Premium");
const { resolvePremiumAccess } = require("../../utils/premiumAccess");

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const IDLE_LEAVE_DELAY_MS = toPositiveNumber(process.env.QUEUE_END_IDLE_LEAVE_MS, 2 * 60 * 1000);
const IDLE_LEAVE_MINUTES = Math.max(1, Math.round(IDLE_LEAVE_DELAY_MS / 60_000));
const IDLE_LEAVE_LABEL = `${IDLE_LEAVE_MINUTES} minute${IDLE_LEAVE_MINUTES === 1 ? "" : "s"}`;
const PREMIUM_NUDGE_COOLDOWN_MS = toPositiveNumber(process.env.QUEUE_END_PREMIUM_NUDGE_COOLDOWN_MS, 24 * 60 * 60 * 1000);
const PREMIUM_NUDGE_CACHE_MAX = toPositiveNumber(process.env.QUEUE_END_PREMIUM_NUDGE_CACHE_MAX, 5000);
const LOG_QUEUE_EVENTS = String(process.env.LOG_QUEUE_EVENTS || "false").toLowerCase() === "true";

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

function prunePremiumNudgeCooldown(client, now = Date.now()) {
  const cooldownMap = client.__queueEndPremiumNudgeCooldown;
  if (!(cooldownMap instanceof Map)) return;

  for (const [guildId, lastSentAt] of cooldownMap.entries()) {
    const raw = Number(lastSentAt || 0);
    if (!Number.isFinite(raw) || raw <= 0 || (now - raw) >= PREMIUM_NUDGE_COOLDOWN_MS) {
      cooldownMap.delete(guildId);
    }
  }

  if (cooldownMap.size <= PREMIUM_NUDGE_CACHE_MAX) return;

  const overflow = cooldownMap.size - PREMIUM_NUDGE_CACHE_MAX;
  let removed = 0;
  for (const guildId of cooldownMap.keys()) {
    cooldownMap.delete(guildId);
    removed += 1;
    if (removed >= overflow) break;
  }
}

async function hasGuildPremium(guildId) {
  const premiumDoc = await Premium.findOne({ Id: guildId, Type: "guild" }).catch(() => null);
  if (!premiumDoc) return false;
  if (premiumDoc.Permanent) return true;

  const expireAt = Number(premiumDoc.Expire || 0);
  if (expireAt > Date.now()) return true;

  await premiumDoc.deleteOne().catch(() => {});
  return false;
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

function hasQueueEndPremiumNudgeCooldown(client, guildId, now = Date.now()) {
  const cooldownMap = client.__queueEndPremiumNudgeCooldown;
  if (!cooldownMap) return false;
  prunePremiumNudgeCooldown(client, now);

  const lastSentAt = Number(cooldownMap.get(guildId) || 0);
  if (!Number.isFinite(lastSentAt) || lastSentAt <= 0) {
    cooldownMap.delete(guildId);
    return false;
  }

  if ((now - lastSentAt) >= PREMIUM_NUDGE_COOLDOWN_MS) {
    cooldownMap.delete(guildId);
    return false;
  }

  return true;
}

function markQueueEndPremiumNudgeSent(client, guildId, now = Date.now()) {
  if (!client.__queueEndPremiumNudgeCooldown) {
    client.__queueEndPremiumNudgeCooldown = new Map();
  }

  prunePremiumNudgeCooldown(client, now);
  client.__queueEndPremiumNudgeCooldown.set(guildId, now);
}

async function maybeSendQueueEndPremiumNudge(client, player, track, textChannel, { guildPremiumHint = false } = {}) {
  if (!textChannel) return false;
  if (guildPremiumHint) return false;

  const now = Date.now();
  if (hasQueueEndPremiumNudgeCooldown(client, player.guildId, now)) {
    return false;
  }

  const requesterId = getRequesterId(player, track);
  let premiumAccess = {
    userPremium: false,
    guildPremium: Boolean(guildPremiumHint),
    hasAccess: Boolean(guildPremiumHint),
  };

  try {
    premiumAccess = await resolvePremiumAccess(requesterId, player.guildId, client);
  } catch (error) {
    logQueueEvent(
      client,
      `Queue-end premium nudge check failed in guild ${player.guildId}: ${error?.message || error}`,
      "warn"
    );
  }

  if (premiumAccess?.hasAccess || premiumAccess?.userPremium || premiumAccess?.guildPremium) {
    return false;
  }

  const voteUrl = `https://top.gg/bot/${client.user.id}/vote`;
  const premiumUrl = `https://top.gg/bot/${client.user.id}`;
  const supportUrl = client?.legalLinks?.supportServerUrl || "https://discord.gg/JQzBqgmwFm";

  const voteButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Vote")
    .setURL(voteUrl);

  const premiumButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Premium")
    .setURL(premiumUrl);

  const supportButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Support")
    .setURL(supportUrl);

  try {
    if (EMOJIS.vote) voteButton.setEmoji(EMOJIS.vote);
  } catch (_e) {}
  try {
    if (EMOJIS.premium || EMOJIS.vip) premiumButton.setEmoji(EMOJIS.premium || EMOJIS.vip);
  } catch (_e) {}
  try {
    if (EMOJIS.support) supportButton.setEmoji(EMOJIS.support);
  } catch (_e) {}

  const row = new ActionRowBuilder().addComponents(voteButton, premiumButton, supportButton);

  const embed = new EmbedBuilder()
    .setColor(client?.embedColor || EMBED_COLOR)
    .setAuthor({ name: "Want A Better Music Experience?", iconURL: client.user.displayAvatarURL() })
    .setDescription(
      "The queue has ended. If you want a smoother experience, you can vote for temporary access or review premium information from the official bot links below."
    )
    .addFields(
      {
        name: "Vote",
        value: "Vote on Top.gg to unlock temporary premium-style access for 12 hours.",
        inline: true,
      },
      {
        name: "Premium",
        value: "Keep music running longer with premium playback perks and extra features.",
        inline: true,
      }
    )
    .setFooter({ text: "Shown occasionally after queue end, not on every queue." });

  try {
    await textChannel.send({ embeds: [embed], components: [row] });
    markQueueEndPremiumNudgeSent(client, player.guildId, now);
    return true;
  } catch (_embedErr) {
    try {
      await textChannel.send(
        `Queue ended. Want a better experience? Vote here: ${voteUrl}\nPremium: ${premiumUrl}\nSupport: ${supportUrl}`
      );
      markQueueEndPremiumNudgeSent(client, player.guildId, now);
      return true;
    } catch (plainErr) {
      logQueueEvent(
        client,
        `Queue-end premium nudge failed in guild ${player.guildId}: ${plainErr?.message || plainErr}`,
        "warn"
      );
      return false;
    }
  }
}

function buildQueueLeaveEmbed(client) {
  return new EmbedBuilder()
    .setColor(client?.embedColor || EMBED_COLOR)
    .setAuthor({ name: " Leaving Voice Channel!", iconURL: client.user.displayAvatarURL() })
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
      await textChannel.send(`Leaving voice channel: queue ended, no 24/7, no premium, and no listeners stayed for ${IDLE_LEAVE_LABEL}.`);
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
  if (!suppressQueueEndNotice && channel) {
    const queueEndEmbed = new EmbedBuilder()
      .setColor(client?.embedColor || EMBED_COLOR)
      .setAuthor({ name: "Queue empty!", iconURL: client.user.displayAvatarURL() })
      .setDescription(
        ` Add more songs or enable [autoplay](https://top.gg/bot/${client.user.id}) or [24/7](https://top.gg/bot/${client.user.id}) mode to listen uninterrupetd music!.`
      );

    await channel.send({ embeds: [queueEndEmbed] }).catch(() => {});
  }

  const isAutoplayEnabled = player.get && player.get("autoplay") === true;
  if (isAutoplayEnabled) return;

  let is247Enabled = false;
  let premiumEnabled = false;

  try {
    const doc = await twentyfourseven.findOne({ guildID: player.guildId });
    is247Enabled = Boolean(doc);
  } catch (err) {
    client.logger?.log?.(`Failed to read 24/7 setting for guild ${player.guildId}: ${err?.message || err}`, "warn");
  }

  try {
    premiumEnabled = await hasGuildPremium(player.guildId);
  } catch (err) {
    client.logger?.log?.(`Failed to read premium setting for guild ${player.guildId}: ${err?.message || err}`, "warn");
  }

  if (!suppressQueueEndNotice && channel && !isAutoplayEnabled && !is247Enabled) {
    await maybeSendQueueEndPremiumNudge(client, player, track, channel, { guildPremiumHint: premiumEnabled }).catch(() => {});
  }

  if (is247Enabled || premiumEnabled) return;

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

      const [keepConnected247, hasPremiumNow] = await Promise.all([
        twentyfourseven.findOne({ guildID: player.guildId }).catch(() => null),
        hasGuildPremium(player.guildId).catch(() => false),
      ]);

      if (keepConnected247 || hasPremiumNow) return;

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
