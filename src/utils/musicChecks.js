/**
 * Shared music command validation checks.
 * Supports both signatures:
 * - runMusicChecks(interaction, client, options)
 * - runMusicChecks(client, interaction, options)
 */

const { EmbedBuilder } = require('discord.js');
const { getQueueArray } = require('./queue');

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const DEFAULT_LAVALINK_COMMAND_WAIT_MS = toPositiveNumber(process.env.LAVALINK_COMMAND_WAIT_MS, 2500);

function buildErrorEmbed(client, text) {
  return new EmbedBuilder()
    .setColor(client?.embedColor || '#ff0051')
    .setDescription(text);
}

function looksLikeInteraction(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value.guildId || value.guild || value.member || typeof value.reply === 'function')
  );
}

function looksLikeClient(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value.lavalink || value.commands || value.sls || (value.user && value.guilds))
  );
}

async function ensureUsableLavalinkNode(
  client,
  {
    timeoutMs = DEFAULT_LAVALINK_COMMAND_WAIT_MS,
    description = 'No Lavalink node is available right now. Please try again in a moment.'
  } = {}
) {
  if (!client?.lavalink) {
    return {
      ok: false,
      embed: buildErrorEmbed(client, 'Lavalink is not connected yet. Please try again in a moment.')
    };
  }

  if (client.lavalink.useable) return { ok: true };

  if (typeof client.waitForLavalinkReady === 'function') {
    try {
      const ready = await client.waitForLavalinkReady(timeoutMs);
      if (ready) return { ok: true };
    } catch (_err) {}
  }

  if (client.lavalink.useable) return { ok: true };

  return {
    ok: false,
    embed: buildErrorEmbed(client, description)
  };
}

function resolveRunArgs(arg1, arg2, arg3) {
  if (looksLikeInteraction(arg1) && looksLikeClient(arg2)) {
    return { interaction: arg1, client: arg2, options: arg3 || {} };
  }

  if (looksLikeClient(arg1) && looksLikeInteraction(arg2)) {
    return { interaction: arg2, client: arg1, options: arg3 || {} };
  }

  return { interaction: null, client: null, options: {} };
}

async function checkInVoiceChannel(interaction, client) {
  if (!interaction?.member?.voice?.channel) {
    return {
      valid: false,
      embed: buildErrorEmbed(client, 'You must be in a voice channel to use this command.')
    };
  }
  return { valid: true };
}

async function checkBotInVoiceChannel(interaction, client) {
  const guild = interaction?.guild;
  if (!guild || !client?.user?.id) {
    return {
      valid: false,
      embed: buildErrorEmbed(client, 'This command can only be used in a server.')
    };
  }

  const botMember = guild.members.cache.get(client.user.id);
  if (!botMember?.voice?.channel) {
    return {
      valid: false,
      embed: buildErrorEmbed(client, 'Bot is not in a voice channel.')
    };
  }
  return { valid: true, channel: botMember.voice.channel };
}

async function checkSameVoiceChannel(interaction, client) {
  const userChannel = interaction?.member?.voice?.channel;
  const botMember = interaction?.guild?.members?.cache?.get(client?.user?.id);
  const botChannel = botMember?.voice?.channel;

  if (!userChannel) {
    return { valid: false, embed: buildErrorEmbed(client, 'You must be in a voice channel.') };
  }

  if (!botChannel) {
    return { valid: false, embed: buildErrorEmbed(client, 'Bot is not in a voice channel.') };
  }

  if (userChannel.id !== botChannel.id) {
    return {
      valid: false,
      embed: buildErrorEmbed(client, 'You must be in the same voice channel as the bot.')
    };
  }

  return { valid: true, channel: userChannel };
}

async function checkPlayer(interaction, client) {
  if (!client?.lavalink) {
    return { valid: false, embed: buildErrorEmbed(client, 'Lavalink is not initialized.') };
  }

  const lavalinkCheck = await ensureUsableLavalinkNode(client, {
    timeoutMs: 1500,
    description: 'No Lavalink node is available right now. Please try again in a moment.'
  });
  if (!lavalinkCheck.ok) {
    return { valid: false, embed: lavalinkCheck.embed };
  }

  const player = client.lavalink.players.get(interaction.guildId);
  if (!player) {
    return {
      valid: false,
      embed: buildErrorEmbed(client, 'No player active. Use /play to start music.')
    };
  }

  return { valid: true, player };
}

async function checkQueue(interaction, player) {
  if (!player) {
    return {
      valid: false,
      embed: buildErrorEmbed(interaction?.client, 'No active player.')
    };
  }

  const queue = getQueueArray(player) || [];
  if (!queue.length) {
    return {
      valid: false,
      embed: buildErrorEmbed(interaction?.client, 'Queue is empty.')
    };
  }

  return { valid: true, queue };
}

async function runMusicChecks(arg1, arg2, arg3 = {}) {
  const { interaction, client, options } = resolveRunArgs(arg1, arg2, arg3);

  if (!interaction || !client) {
    return {
      valid: false,
      embed: buildErrorEmbed(client, 'Internal validation error. Please try again.')
    };
  }

  const requireInVoice = options.inVoiceChannel !== undefined ? options.inVoiceChannel : true;
  const requireBotInVoice = options.botInVoiceChannel !== undefined ? options.botInVoiceChannel : true;
  const requireSameVoice = options.sameChannel !== undefined
    ? options.sameChannel
    : (options.sameVoiceChannel !== undefined
      ? options.sameVoiceChannel
      : (options.requireSameVoice !== undefined ? options.requireSameVoice : true));
  const requirePlayerCheck = options.requirePlayer !== undefined ? options.requirePlayer : true;
  const requireQueue = options.requireQueue !== undefined ? options.requireQueue : false;

  if (requireInVoice) {
    const voiceCheck = await checkInVoiceChannel(interaction, client);
    if (!voiceCheck.valid) return voiceCheck;
  }

  if (requireBotInVoice) {
    const botCheck = await checkBotInVoiceChannel(interaction, client);
    if (!botCheck.valid) return botCheck;
  }

  if (requireSameVoice) {
    const sameCheck = await checkSameVoiceChannel(interaction, client);
    if (!sameCheck.valid) return sameCheck;
  }

  let player = null;
  if (requirePlayerCheck || requireQueue) {
    const playerCheck = await checkPlayer(interaction, client);
    if (!playerCheck.valid) return playerCheck;
    player = playerCheck.player;
  }

  if (requireQueue) {
    const queueCheck = await checkQueue(interaction, player);
    if (!queueCheck.valid) return queueCheck;
    return { valid: true, player, queue: queueCheck.queue };
  }

  return { valid: true, player };
}

module.exports = {
  checkInVoiceChannel,
  checkBotInVoiceChannel,
  checkSameVoiceChannel,
  checkPlayer,
  checkQueue,
  runMusicChecks
};
