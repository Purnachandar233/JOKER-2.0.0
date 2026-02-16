const { EmbedBuilder, CommandInteraction, Client } = require("discord.js");
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');
const safePlayer = require('../../utils/safePlayer');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "join",
  description: "Join voice channel",
  owner: false,
  player: false,
  djonly: true,
  inVoiceChannel: true,
  sameVoiceChannel: true,
  wl: true,

  /**
   *
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */

  run: async (client, interaction) => {
    return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
      await safeReply.safeDeferReply(interaction);

      let ok = EMOJIS.ok;
      let no = EMOJIS.no;

      const { channel } = interaction.member.voice;
      if (!channel) {
        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} You must be connected to a voice channel to use this command.`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      if (interaction.member.voice.selfDeaf) {
        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} <@${interaction.member.id}> You cannot run this command while deafened.`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      try {
        let player = client.lavalink.players.get(interaction.guild.id);

        if (!player) {
          // Create new player
          player = client.lavalink.createPlayer({
            guildId: interaction.guild.id,
            voiceChannelId: channel.id,
            textChannelId: interaction.channel.id,
            selfDeafen: true,
          });

          await safePlayer.safeCall(player, 'connect');

          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${ok} Connected to \`${channel.name}\``);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }
        else if (interaction.guild.me.voice.channel !== channel) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} You must be in the same channel as me.`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }
        else {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} I am already connected to a voice channel.`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }
      } catch (err) {
        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} Failed to join voice channel: ${err && (err.message || err)}`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }
    });
  }
};
