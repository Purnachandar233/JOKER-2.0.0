const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/fun/actions/slap.js');
const { safeReply, safeDeferReply } = require('../../utils/interactionResponder');


module.exports = {
  name: 'slap',
  description: legacy.description || 'Give someone a playful slap!',
  options: [ { name: 'user', description: 'User to slap', required: true, type: 9 } ],
  run: async (client, interaction) => {
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: 'Failed to defer reply.' });
    const user = interaction.options.getUser('user');
    const args = [user.id];

        try {
      if (typeof legacy.execute === 'function') {
        await legacy.execute(interaction, args, client, client.prefix);
      } else if (typeof legacy.run === 'function') {
        await legacy.run(client, interaction);
      } else {
        await interaction.editReply({ content: 'No executable legacy handler found.' }).catch(() => {});
      }
    } catch (err) {
      client.logger?.log('Converted slash slap error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};


