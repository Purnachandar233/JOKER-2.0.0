const { EmbedBuilder, CommandInteraction, Client } = require("discord.js");
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');
const safePlayer = require('../../utils/safePlayer');

module.exports = {
  name: "disconnect",
  description: "Leave voice channel",
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
      
      let ok = client.emoji.ok;
      let no = client.emoji.no;
      
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

      const player = client.lavalink.players.get(interaction.guild.id);
      const tracks = safePlayer.getQueueArray(player);

      if (!player || !tracks || tracks.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} There is nothing playing in this server.`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      if (player && channel.id !== player.voiceChannelId) {
        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} You must be connected to the same voice channel as me.`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      try {
        await safePlayer.safeDestroy(player);
        const msg = player.get('playingsongmsg');
        if (msg && msg.delete) {
          msg.delete().catch(() => {});
        }

        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${ok} Destroyed the player and left the voice channel \`${channel.name}\``);
        
        await safeReply.safeReply(interaction, { embeds: [embed] });
        client.logger.logCommand('disconnect', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
      } catch (err) {
        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} Failed to disconnect: ${err && (err.message || err)}`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }
    });
  }
};



