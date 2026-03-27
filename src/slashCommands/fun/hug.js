const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/fun/actions/hug.js');
const { safeReply } = require('../../utils/interactionResponder');


module.exports = {
  name: 'hug',
  description: legacy.description || 'Give someone a warm hug!',
  options: [ { name: 'user', description: 'User to hug', required: true, type: 9 } ],
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
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
      client.logger?.log('Converted slash hug error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};


