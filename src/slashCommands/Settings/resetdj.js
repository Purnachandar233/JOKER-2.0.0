const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const dSchema = require('../../../src/schema/djroleSchema.js');
const { safeReply, safeDeferReply } = require('../../utils/safeReply');

module.exports = {
  name: "resetdj",
  description: "Reset the DJ role configuration for this server",
  owner: false,
  votelock: true,
  wl: true,
  options: [],

  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: 'Failed to defer reply.' });

    if (!interaction.member.permissions.has('MANAGE_ROLES') && !interaction.member.permissions.has('ADMINISTRATOR')) {
      const noperms = new EmbedBuilder()
        .setColor(client?.embedColor || '#ff0051')
        .setDescription('*You need the `Manage Roles` or `Administrator` permission to reset the DJ role.*');
      return await interaction.editReply({ embeds: [noperms] }).catch(() => {});
    }

    try {
      const deleted = await dSchema.findOneAndDelete({ guildID: interaction.guild.id });
      if (!deleted) {
        const embed = new EmbedBuilder().setColor(client?.embedColor || '#ff0051').setDescription('No DJ role was configured for this server.');
        return await interaction.editReply({ embeds: [embed] }).catch(() => {});
      }
      const embed = new EmbedBuilder().setColor(client?.embedColor || '#ff0051').setDescription('Reset the DJ role configuration for this server.');
      return await interaction.editReply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      client.logger?.log(`Failed to reset DJ role: ${err && (err.stack || err.toString())}`, 'error');
      const embed = new EmbedBuilder().setDescription('Failed to reset DJ role.').setColor(client?.embedColor || '#ff0051');
      return await interaction.editReply({ embeds: [embed] }).catch(() => {});
    }
  }
};
