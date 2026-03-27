const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/settings/setdj.js');
const { safeReply, safeDeferReply } = require('../../utils/interactionResponder');


module.exports = {
  name: 'setdj',
  description: legacy.description || 'Converted slash for setdj',
  options: [ { name: 'role', description: 'Role to set as DJ role', required: true, type: 8 } ],
  run: async (client, interaction) => {
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: 'Failed to defer reply.' });
    const role = interaction.options.getRole('role');
    const argstr = role?.id || '';
    const args = argstr.length ? argstr.trim().split(/ +/) : [];

        try {
      if (typeof legacy.execute === 'function') {
        await legacy.execute(interaction, args, client, client.prefix);
      } else if (typeof legacy.run === 'function') {
        await legacy.run(client, interaction);
      } else {
        await interaction.editReply({ content: 'No executable legacy handler found.' }).catch(() => {});
      }
    } catch (err) {
      client.logger?.log('Converted slash setdj error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};


