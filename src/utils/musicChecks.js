/**
 * Shared music command validation checks
 * Prevents duplicate checks across all music commands
 */

const { EmbedBuilder } = require('discord.js');

async function checkInVoiceChannel(interaction, client) {
  if (!interaction.member?.voice?.channel) {
    const embed = new EmbedBuilder()
      .setColor(client.embedColor || '#ff0051')
      .setDescription('❌ You must be in a voice channel to use this command.');
    return { valid: false, embed };
  }
  return { valid: true };
}

async function checkBotInVoiceChannel(interaction, client) {
  const botMember = interaction.guild.members.cache.get(client.user.id);
  if (!botMember?.voice?.channel) {
    const embed = new EmbedBuilder()
      .setColor(client.embedColor || '#ff0051')
      .setDescription('❌ Bot is not in a voice channel.');
    return { valid: false, embed };
  }
  return { valid: true, channel: botMember.voice.channel };
}

async function checkSameVoiceChannel(interaction, client) {
  const userChannel = interaction.member?.voice?.channel;
  const botMember = interaction.guild.members.cache.get(client.user.id);
  const botChannel = botMember?.voice?.channel;

  if (!userChannel) {
    const embed = new EmbedBuilder()
      .setColor(client.embedColor || '#ff0051')
      .setDescription('❌ You must be in a voice channel.');
    return { valid: false, embed };
  }

  if (!botChannel) {
    const embed = new EmbedBuilder()
      .setColor(client.embedColor || '#ff0051')
      .setDescription('❌ Bot is not in a voice channel.');
    return { valid: false, embed };
  }

  if (userChannel.id !== botChannel.id) {
    const embed = new EmbedBuilder()
      .setColor(client.embedColor || '#ff0051')
      .setDescription('❌ You must be in the same voice channel as the bot.');
    return { valid: false, embed };
  }

  return { valid: true, channel: userChannel };
}

async function checkPlayer(interaction, client) {
  if (!client.lavalink) {
    const embed = new EmbedBuilder()
      .setColor(client.embedColor || '#ff0051')
      .setDescription('❌ Lavalink is not initialized.');
    return { valid: false, embed };
  }

  const player = client.lavalink.players.get(interaction.guildId);
  if (!player) {
    const embed = new EmbedBuilder()
      .setColor(client.embedColor || '#ff0051')
      .setDescription('❌ No player active. Use `/play` to start music.');
    return { valid: false, embed };
  }

  return { valid: true, player };
}

async function checkQueue(interaction, player) {
  if (!player) {
    const embed = new EmbedBuilder()
      .setColor(interaction.client?.embedColor || '#ff0051')
      .setDescription('❌ No active player.');
    return { valid: false, embed };
  }

  const queue = player.queue || [];
  if (!queue || queue.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(interaction.client?.embedColor || '#ff0051')
      .setDescription('❌ Queue is empty.');
    return { valid: false, embed };
  }

  return { valid: true, queue };
}

/**
 * Run all standard music command checks
 */
async function runMusicChecks(interaction, client, options = {}) {
  const { requireQueue = false, requireSameVoice = true } = options;

  // Check voice channel
  const voiceCheck = await checkInVoiceChannel(interaction, client);
  if (!voiceCheck.valid) return voiceCheck;

  // Check bot voice
  const botCheck = await checkBotInVoiceChannel(interaction, client);
  if (!botCheck.valid) return botCheck;

  // Check same channel if required
  if (requireSameVoice) {
    const sameCheck = await checkSameVoiceChannel(interaction, client);
    if (!sameCheck.valid) return sameCheck;
  }

  // Check player
  const playerCheck = await checkPlayer(interaction, client);
  if (!playerCheck.valid) return playerCheck;

  // Check queue if required
  if (requireQueue) {
    const queueCheck = await checkQueue(interaction, playerCheck.player);
    if (!queueCheck.valid) return queueCheck;
  }

  return { valid: true, player: playerCheck.player };
}

module.exports = {
  checkInVoiceChannel,
  checkBotInVoiceChannel,
  checkSameVoiceChannel,
  checkPlayer,
  checkQueue,
  runMusicChecks
};
