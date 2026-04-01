const { ChannelType, EmbedBuilder } = require("discord.js");
const twentyFourSevenSchema = require("../../schema/twentyfourseven.js");
const EMBED_COLOR = "#ff0051";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const BOT_VOICE_DISCONNECT_GRACE_MS = toPositiveNumber(process.env.BOT_VOICE_DISCONNECT_GRACE_MS, 5000);
const QUEUE_END_IDLE_MINUTES = Math.max(
  1,
  Math.round(toPositiveNumber(process.env.QUEUE_END_IDLE_LEAVE_MS, 2 * 60 * 1000) / 60_000)
);
const QUEUE_END_IDLE_LABEL = `${QUEUE_END_IDLE_MINUTES} minute${QUEUE_END_IDLE_MINUTES === 1 ? "" : "s"}`;
const INACTIVITY_DISCONNECT_MS = toPositiveNumber(process.env.VOICE_EMPTY_DISCONNECT_MS, 3 * 60 * 1000);
const INACTIVITY_DISCONNECT_MINUTES = Math.max(1, Math.round(INACTIVITY_DISCONNECT_MS / 60_000));
const INACTIVITY_DISCONNECT_LABEL = `${INACTIVITY_DISCONNECT_MINUTES} minute${INACTIVITY_DISCONNECT_MINUTES === 1 ? "" : "s"}`;

function getChannelMention(channelId, fallback = "the voice channel") {
  const id = String(channelId || "").trim();
  return id ? `<#${id}>` : fallback;
}

async function getSlashCommandMention(client, commandName, fallback = null) {
  const name = String(commandName || "").trim();
  const fallbackText = fallback || (name ? `/${name}` : "/");
  if (!name) return fallbackText;

  const cache = client
    ? (client.__slashCommandMentionCache ||= new Map())
    : null;
  const cached = cache?.get(name);
  if (cached) return cached;

  const appCommands = client?.application?.commands;
  if (!appCommands) return fallbackText;

  let command = appCommands.cache?.find?.((entry) => entry.name === name) || null;

  if (!command && typeof appCommands.fetch === "function") {
    const fetched = await appCommands.fetch().catch(() => null);
    command =
      fetched?.find?.((entry) => entry.name === name) ||
      appCommands.cache?.find?.((entry) => entry.name === name) ||
      null;
  }

  if (!command?.id) return fallbackText;

  const mention = `</${command.name}:${command.id}>`;
  cache?.set(name, mention);
  return mention;
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

async function resolveVoiceChannel(client, guild, channelId) {
  if (!guild || !channelId) return null;

  const cached = guild.channels.cache.get(channelId) || client.channels.cache.get(channelId);
  if (cached) return cached;

  if (typeof client.channels?.fetch === "function") {
    return client.channels.fetch(channelId).catch(() => null);
  }

  return null;
}

function getHumanListenerCount(guild, voiceChannelId, voiceChannel = null) {
  if (!guild || !voiceChannelId) return 0;

  const humansFromVoiceStates = guild.voiceStates?.cache?.filter?.((state) => (
    state.channelId === voiceChannelId && !state.member?.user?.bot
  )).size;

  if (Number.isFinite(humansFromVoiceStates) && humansFromVoiceStates > 0) {
    return humansFromVoiceStates;
  }

  const memberCollection = voiceChannel?.members;
  if (memberCollection?.size) {
    return memberCollection.filter((member) => !member.user?.bot).size;
  }

  return 0;
}

function buildQueueEndLeaveEmbed(client, options = {}) {
  const voiceMention = options.voiceMention || "the voice channel";
  const commandMention = options.commandMention || "/247";

  return new EmbedBuilder()
    .setColor(client?.embedColor || EMBED_COLOR)
    .setAuthor({ name: "Leaving Voice Channel!", iconURL: client.user.displayAvatarURL() })
    .setDescription(
      `Since nobody listened in ${voiceMention} for ${QUEUE_END_IDLE_LABEL}, I've left ${voiceMention}. Want me to stay there all the time? Use the ${commandMention} command!`
    );
}

function buildInactivityEmbed(client, options = {}) {
  const voiceMention = options.voiceMention || "the voice channel";
  const commandMention = options.commandMention || "/247";

  return new EmbedBuilder()
    .setColor(client?.embedColor || EMBED_COLOR)
    .setAuthor({ name: "Disconnected Due To Inactivity!", iconURL: client.user.displayAvatarURL() })
    .setDescription(
      `I left ${voiceMention} because no listeners remained there for ${INACTIVITY_DISCONNECT_LABEL}.\nUse the ${commandMention} command to keep me connected there.`
    );
}

async function sendLeaveNotice(client, player, embed, fallbackText) {
  const textChannel = await resolveTextChannel(client, player?.textChannelId);
  if (!textChannel) return false;

  try {
    await textChannel.send({ embeds: [embed] });
    return true;
  } catch (_embedError) {
    try {
      await textChannel.send(fallbackText);
      return true;
    } catch (_plainError) {
      return false;
    }
  }
}

module.exports = async (client, oldState, newState) => {
  const player = client.lavalink?.players.get(newState.guild.id);
  if (!player) return;

  if (newState.id === client.user.id) {
    const wasServerMuted = Boolean(oldState.serverMute ?? oldState.mute);
    const isServerMuted = Boolean(newState.serverMute ?? newState.mute);
    const autoPausedByServerMute = Boolean(
      typeof player.get === "function" ? player.get("autoPausedByServerMute") : false
    );

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

    if (wasServerMuted !== isServerMuted) {
      if (isServerMuted) {
        if (!player.paused) {
          await player.pause().catch(() => {});
          if (typeof player.set === "function") {
            player.set("autoPausedByServerMute", true);
          }
        }
      } else if (autoPausedByServerMute) {
        if (typeof player.set === "function") {
          player.set("autoPausedByServerMute", false);
        }
        if (player.paused) {
          await player.resume().catch(() => {});
        }
      }
    }

    // Discord can briefly report the bot as not connected while joining or
    // moving voice channels. Re-check once before destroying the player.
    if (!newState.channelId) {
      await wait(BOT_VOICE_DISCONNECT_GRACE_MS);
      const refreshedBotChannelId = newState.guild.members.me?.voice?.channelId || null;
      if (refreshedBotChannelId) return;

      const queueEndTimerActive = Boolean(client.__queueEndLeaveTimers?.has?.(newState.guild.id));
      if (queueEndTimerActive && !playerHasActiveQueue(player)) {
        clearQueueEndLeaveTimer(client, newState.guild.id);
        const voiceMention = getChannelMention(oldState.channelId || player?.voiceChannelId || player?.options?.voiceChannelId);
        const commandMention = await getSlashCommandMention(client, "247");
        await sendLeaveNotice(
          client,
          player,
          buildQueueEndLeaveEmbed(client, { voiceMention, commandMention }),
          `Leaving ${voiceMention}: queue ended and no listeners stayed for ${QUEUE_END_IDLE_LABEL}. Use the ${commandMention} command to keep me connected there.`
        );
      }

      await player.destroy().catch(() => {});
    }
    return;
  }

  if (!oldState.channelId || oldState.channelId === newState.channelId) return;

  const guild = newState.guild || oldState.guild;
  const currentBotChannelId = guild.members.me?.voice?.channelId || null;
  if (!currentBotChannelId) return;

  if (currentBotChannelId !== oldState.channelId) return;

  const queueEndedWithoutTracks = !playerHasActiveQueue(player);
  const queueEndTimerActive = Boolean(client.__queueEndLeaveTimers?.has?.(guild.id));
  if (queueEndedWithoutTracks || queueEndTimerActive) return;

  const keepConnected = await twentyFourSevenSchema.findOne({ guildID: guild.id }).catch(() => null);
  if (keepConnected) return;

  const leftChannel = await resolveVoiceChannel(client, guild, currentBotChannelId);
  if (!leftChannel) return;

  const hasHumansNow = getHumanListenerCount(guild, currentBotChannelId, leftChannel) > 0;
  if (hasHumansNow) return;

  await wait(INACTIVITY_DISCONNECT_MS);

  const activePlayer = client.lavalink?.players.get(guild.id);
  if (!activePlayer || activePlayer !== player) return;

  const refreshedBotChannelId = guild.members.me?.voice?.channelId || null;
  if (!refreshedBotChannelId || refreshedBotChannelId !== currentBotChannelId) return;

  const queueStillEnded = !playerHasActiveQueue(player);
  if (queueStillEnded) return;

  const refreshedKeepConnected = await twentyFourSevenSchema.findOne({ guildID: guild.id }).catch(() => null);
  if (refreshedKeepConnected) return;

  const refreshedChannel = await resolveVoiceChannel(client, guild, refreshedBotChannelId);
  if (!refreshedChannel) return;

  const stillEmpty = getHumanListenerCount(guild, refreshedBotChannelId, refreshedChannel) === 0;
  if (!stillEmpty) return;

  const voiceMention = getChannelMention(refreshedBotChannelId);
  const commandMention = await getSlashCommandMention(client, "247");
  await sendLeaveNotice(
    client,
    player,
    buildInactivityEmbed(client, { voiceMention, commandMention }),
    `Leaving ${voiceMention} because no listeners remained for ${INACTIVITY_DISCONNECT_LABEL}. Use the ${commandMention} command to keep me connected there.`
  );
  await player.destroy().catch(() => {});
};
