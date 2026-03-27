const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/fun/actions/ship.js');
const { safeReply, safeDeferReply } = require('../../utils/interactionResponder');


module.exports = {
  name: 'ship',
  description: legacy.description || 'Ship two users together!',
  options: [
    { name: 'user1', description: 'First user to ship', required: true, type: 9 },
    { name: 'user2', description: 'Second user to ship', required: true, type: 9 }
  ],
  run: async (client, interaction) => {
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: 'Failed to defer reply.' });
    const user1 = interaction.options.getUser('user1');
    const user2 = interaction.options.getUser('user2');
    const args = [];

        try {
      if (typeof legacy.execute === 'function') {
        await legacy.execute(interaction, args, client, client.prefix);
      } else if (typeof legacy.run === 'function') {
        await legacy.run(client, interaction);
      } else {
        await interaction.editReply({ content: 'No executable legacy handler found.' }).catch(() => {});
      }
    } catch (err) {
      client.logger?.log('Converted slash ship error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};


