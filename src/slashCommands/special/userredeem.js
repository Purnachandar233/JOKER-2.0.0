const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/special/userredeem.js');
const { safeReply, safeDeferReply } = require('../../utils/interactionResponder');


module.exports = {
  name: 'userredeem',
  description: legacy.description || 'Converted slash for userredeem',
  options: [ { name: 'code', description: 'enter code ', required: false, type: 3 } ],
  run: async (client, interaction) => {
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: 'Failed to defer reply.' });
    const argstr = interaction.options.getString('code') || '';
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
      client.logger?.log('Converted slash userredeem error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};


