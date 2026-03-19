const { EmbedBuilder } = require("discord.js");
const EMBED_COLOR = "#ff0051";

const twentyfourseven = require("../../schema/twentyfourseven");
const Premium = require("../../schema/Premium");

const IDLE_LEAVE_DELAY_MS = 2 * 60 * 1000;

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
    player.voiceChannelId ||
    guild?.members?.me?.voice?.channelId ||
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
  return (
    Boolean(player?.queue?.current) ||
    Boolean(player?.playing) ||
    Boolean(player?.paused) ||
    (Array.isArray(player?.queue?.tracks) && player.queue.tracks.length > 0)
  );
}

module.exports = async (client, player, track, payload) => {
  const queueEndReason = payload?.reason || payload?.type || "unknown";

  client.logger?.log?.(
    `Queue ended in guild ${player.guildId} (reason=${queueEndReason}).`,
    "warn"
  );

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
      .setTitle(" Queue Ended ")
      .setDescription(
        ` Add more songs or enable [autoplay](https://top.gg/bot/${client.user.id}) or [24/7](https://top.gg/bot/${client.user.id}) mode to keep the player alive after the queue ends.\nIf no non-bot listeners stay with me, I will leave in 2 minutes.`
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
        client.logger?.log?.(`Queue-end auto-leave in guild ${player.guildId}: voice channel missing.`, "warn");
        await player.destroy().catch(() => {});
        return;
      }

      const humanListenerCount = getHumanListenerCount(client, player, voiceChannel);
      if (humanListenerCount > 0) {
        client.logger?.log?.(
          `Queue-end auto-leave cancelled in guild ${player.guildId}: ${humanListenerCount} listener(s) still present.`,
          "info"
        );
        return;
      }

      const leaveEmbed = new EmbedBuilder()
        .setColor(client?.embedColor || EMBED_COLOR)
        .setTitle(" Leaving Voice Channel ")
        .setDescription("I left the voice channel because the queue ended, 24/7 is disabled, this server has no premium, and no listeners stayed with me for 2 minutes.");

      const textChannel = await resolveTextChannel(client, player.textChannelId);
      if (textChannel) {
        await textChannel.send({ embeds: [leaveEmbed] }).catch(() => {});
      } else {
        client.logger?.log?.(
          `Queue-end auto-leave notice failed in guild ${player.guildId}: text channel ${player.textChannelId} not found.`,
          "warn"
        );
      }

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

  client.__queueEndLeaveTimers.set(player.guildId, idleLeaveTimer);
};
