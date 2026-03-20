const { ChannelType, EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";
const delay = require("delay").default;

function getEmoji(client, key, fallback = "") {
  return EMOJIS[key] || fallback;
}

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const BOT_VOICE_DISCONNECT_GRACE_MS = toPositiveNumber(process.env.BOT_VOICE_DISCONNECT_GRACE_MS, 5000);
const QUEUE_END_IDLE_LEAVE_MS = toPositiveNumber(process.env.QUEUE_END_IDLE_LEAVE_MS, 2 * 60 * 1000);
const QUEUE_END_IDLE_MINUTES = Math.max(1, Math.round(QUEUE_END_IDLE_LEAVE_MS / 60_000));
const QUEUE_END_IDLE_LABEL = `${QUEUE_END_IDLE_MINUTES} minute${QUEUE_END_IDLE_MINUTES === 1 ? "" : "s"}`;

function playerHasActiveQueue(player) {
  return (
    Boolean(player?.queue?.current) ||
    Boolean(player?.playing) ||
    Boolean(player?.paused) ||
    (Array.isArray(player?.queue?.tracks) && player.queue.tracks.length > 0)
  );
}

function clearQueueEndLeaveTimer(client, guildId) {
  const timers = client.__queueEndLeaveTimers;
  if (!timers) return;

  const timer = timers.get(guildId);
  if (!timer) return;

  clearTimeout(timer);
  timers.delete(guildId);
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

module.exports = async (client, oldState, newState) => {
  const player = client.lavalink?.players.get(newState.guild.id);
  if (!player) return;

  if (newState.id === client.user.id) {
    const joinedChannel = newState.guild.channels.cache.get(newState.channel?.id ?? newState.channelId);
    if (joinedChannel?.type === ChannelType.GuildStageVoice) {
      if (!oldState.channelId) {
        try {
          await newState.guild.members.me?.voice?.setSuppressed(false);
        } catch (_err) {
          try {
            await newState.guild.members.me?.voice?.setRequestToSpeak(true);
          } catch (_e) {}
          if (!player.paused) await player.pause().catch(() => {});
        }
      } else if (oldState.suppress !== newState.suppress) {
        if (newState.suppress) await player.pause().catch(() => {});
        else if (player.paused) await player.resume().catch(() => {});
      }
    }

    // Discord can briefly report the bot as not connected while joining or
    // moving voice channels. Re-check once before destroying the player.
    if (!newState.channelId) {
      await delay(BOT_VOICE_DISCONNECT_GRACE_MS);
      const refreshedBotChannelId = newState.guild.members.me?.voice?.channelId || null;
      if (refreshedBotChannelId) return;

      const queueEndTimerActive = Boolean(client.__queueEndLeaveTimers?.has?.(newState.guild.id));
      if (queueEndTimerActive && !playerHasActiveQueue(player)) {
        clearQueueEndLeaveTimer(client, newState.guild.id);

        const leaveEmbed = new EmbedBuilder()
          .setColor(client?.embedColor || EMBED_COLOR)
          .setAuthor({ name: " Leaving Voice Channel ", iconURL: client.user.displayAvatarURL() })
          .setDescription(`I left the voice channel because the queue ended, 24/7 is disabled, this server has no premium, and no listeners stayed with me for ${QUEUE_END_IDLE_LABEL}.`);

        const textChannel = await resolveTextChannel(client, player.textChannelId);
        if (textChannel) {
          await textChannel.send({ embeds: [leaveEmbed] }).catch(async () => {
            await textChannel.send(`Leaving voice channel: queue ended, no 24/7, no premium, and no listeners stayed for ${QUEUE_END_IDLE_LABEL}.`).catch(() => {});
          });
        }
      }

      await player.destroy().catch(() => {});
    }
    return;
  }

  const currentBotChannelId = newState.guild.members.me?.voice?.channelId || null;
  if (!currentBotChannelId) return;

  const botMemberAtOldState = oldState.guild.members.cache.get(client.user.id);
  if (!botMemberAtOldState?.voice?.channelId) return;

  const twentyFourSevenSchema = require("../../schema/twentyfourseven.js");
  const keepConnected = await twentyFourSevenSchema.findOne({ guildID: oldState.guild.id });
  if (keepConnected) return;

  if (botMemberAtOldState.voice.channelId !== oldState.channelId) return;

  const leftChannel = botMemberAtOldState.voice.channel;
  if (!leftChannel) return;

  const hasHumansNow = leftChannel.members.some(member => !member.user.bot);
  if (hasHumansNow) return;

  await delay(180000);

  const refreshedBotMember = oldState.guild.members.cache.get(client.user.id);
  if (!refreshedBotMember?.voice?.channel) return;
  const stillEmpty = !refreshedBotMember.voice.channel.members.some(member => !member.user.bot);
  if (!stillEmpty) return;

  await player.destroy().catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(client?.embedColor || EMBED_COLOR)
    .setTitle(`${getEmoji(client, "info")} Disconnected Due To Inactivity`)
    .setDescription("I left the voice channel because no listeners remained for 3 minutes.\nEnable 24/7 mode to keep me connected.");

  const textChannel = client.channels.cache.get(player.textChannelId);
  if (textChannel) {
    await textChannel.send({ embeds: [embed] }).catch(() => {});
  }
};
