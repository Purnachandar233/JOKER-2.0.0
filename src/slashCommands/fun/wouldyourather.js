const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/fun/games/wouldyourather.js');const { safeReply, safeDeferReply } = require('../../utils/interactionResponder');

module.exports = {
  name: 'wouldyourather',
  description: legacy.description || 'Play a game of Would You Rather!',
  options: [],
  run: async (client, interaction) => {
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: 'Failed to defer reply.' });

        try {
      if (typeof legacy.execute === 'function') {
        await legacy.execute(interaction, [], client, client.prefix);
      } else if (typeof legacy.run === 'function') {
        await legacy.run(client, interaction);
      } else {
        await interaction.editReply({ content: 'No executable legacy handler found.' }).catch(() => {});
      }
    } catch (err) {
      client.logger?.log('Converted slash wouldyourather error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};


