const { Client, CommandInteraction, EmbedBuilder } = require('discord.js');
const legacy = require('../../commands/fun/games/coinflip.js');


module.exports = {
  name: 'coinflip',
  description: legacy.description || 'Flip a coin and predict the outcome!',
  options: [],
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});

        try {
      if (typeof legacy.execute === 'function') {
        await legacy.execute(interaction, [], client, client.prefix);
      } else if (typeof legacy.run === 'function') {
        await legacy.run(client, interaction);
      } else {
        await interaction.editReply({ content: 'No executable legacy handler found.' }).catch(() => {});
      }
    } catch (err) {
      client.logger?.log('Converted slash coinflip error: ' + (err && (err.stack || err.toString())), 'error');
      await interaction.editReply({ content: 'An error occurred running this command.' }).catch(() => {});
    }
  }
};


