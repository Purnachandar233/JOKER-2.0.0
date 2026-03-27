const legacy = require('../../commands/fun/games/tictactoe.js');

module.exports = {
  name: 'tictactoe',
  description: 'Play Tic-Tac-Toe against the bot AI.',
  run: async (client, interaction) => {
    if (typeof legacy.execute !== 'function') {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: 'TicTacToe command handler is unavailable.', ephemeral: true }).catch(() => {});
      } else {
        await interaction.editReply({ content: 'TicTacToe command handler is unavailable.' }).catch(() => {});
      }
      return;
    }

    await legacy.execute(interaction, [], client);
  }
};
