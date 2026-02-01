const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const PrefixSchema = require('../../../src/schema/prefix.js');

module.exports = {
  name: "setprefix",
  description: "Set a custom server prefix (max 5 chars)",
  owner: false,
  votelock: true,
  wl: true,
  options: [
    {
      name: 'prefix',
      description: 'New prefix (max 5 characters)',
      required: true,
      type: 3,
    }
  ],

  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});

    // Require Manage Server or Administrator
    if (!interaction.member.permissions.has('MANAGE_GUILD') && !interaction.member.permissions.has('ADMINISTRATOR')) {
      const noperms = new EmbedBuilder()
        .setColor(client?.embedColor || '#ff0051')
        .setDescription('*You need the `Manage Server` or `Administrator` permission to change the prefix.*');
      return await interaction.editReply({ embeds: [noperms] }).catch(() => {});
    }

    const pre = interaction.options.getString('prefix');
    if (!pre) {
      const embed = new EmbedBuilder().setDescription('*Please provide the prefix you wish to set.*').setColor(client?.embedColor || '#ff0051');
      return await interaction.editReply({ embeds: [embed] }).catch(() => {});
    }

    if (pre.length > 5) {
      const embed = new EmbedBuilder().setDescription('*The prefix must be 5 characters or less.*').setColor(client?.embedColor || '#ff0051');
      return await interaction.editReply({ embeds: [embed] }).catch(() => {});
    }

    try {
      const data = await PrefixSchema.findOne({ Guild: interaction.guild.id });
      if (data) {
        data.oldPrefix = client.prefix;
        data.Prefix = pre;
        await data.save();
      } else {
        await new PrefixSchema({ Guild: interaction.guild.id, Prefix: pre, oldPrefix: client.prefix }).save();
      }
      // Update in-memory client prefix for this guild if you track it elsewhere
      const success = new EmbedBuilder().setDescription(`✧ The prefix for this server has been updated to **${pre}**`).setColor(client?.embedColor || '#ff0051');
      return await interaction.editReply({ embeds: [success] }).catch(() => {});
    } catch (err) {
      client.logger?.log(`Failed to set prefix: ${err && (err.stack || err.toString())}`, 'error');
      const embed = new EmbedBuilder().setDescription('Failed to update prefix.').setColor(client?.embedColor || '#ff0051');
      return await interaction.editReply({ embeds: [embed] }).catch(() => {});
    }
  }
};
