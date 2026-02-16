const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  name: "tictactoe",
  category: "fun",
  aliases: ["ttt"],
  description: "Play Tic Tac Toe with another player!",
  execute: async (message, args, client) => {
    const opponent = message.mentions.users.first();

    if (!opponent) {
      return message.reply("Please mention a player to play against! Example: `=tictactoe @user`");
    }

    if (opponent.id === message.author.id) {
      return message.reply("You cannot play against yourself.");
    }

    if (opponent.bot && opponent.id !== client.user.id) {
      return message.reply("You can only play against real users or me.");
    }

    const board = Array(9).fill(null);
    const player1 = message.author;
    const player2 = opponent;
    let currentPlayer = player1;

    const getCellLabel = index => {
      if (board[index] === "X") return "X";
      if (board[index] === "O") return "O";
      return `${index + 1}`;
    };

    const boardText = () => `${getCellLabel(0)} ${getCellLabel(1)} ${getCellLabel(2)}\n${getCellLabel(3)} ${getCellLabel(4)} ${getCellLabel(5)}\n${getCellLabel(6)} ${getCellLabel(7)} ${getCellLabel(8)}`;

    const checkWinner = () => {
      const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
      ];

      for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
          return board[a];
        }
      }
      return null;
    };

    const isBoardFull = () => board.every(cell => cell !== null);

    const createGameEmbed = () => new EmbedBuilder()
      .setColor(client.embedColor || "#00ff00")
      .setTitle("Tic Tac Toe")
      .setDescription(boardText())
      .addFields(
        { name: "Player 1 (X)", value: player1.username, inline: true },
        { name: "Player 2 (O)", value: player2.username, inline: true },
        { name: "Current Turn", value: currentPlayer.username, inline: false }
      )
const createGameButtons = () => {
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 3; j++) {
          const index = i * 3 + j;
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`ttt_${index}`)
              .setLabel(getCellLabel(index))
              .setStyle(board[index] ? ButtonStyle.Secondary : ButtonStyle.Primary)
              .setDisabled(board[index] !== null)
          );
        }
        rows.push(row);
      }
      return rows;
    };

    const gameMsg = await message.channel.send({
      embeds: [createGameEmbed()],
      components: createGameButtons()
    });

    const collector = gameMsg.createMessageComponentCollector({
      filter: i => i.customId.startsWith("ttt_"),
      time: 60000
    });

    collector.on("collect", async interaction => {
      if (interaction.user.id !== player1.id && interaction.user.id !== player2.id) {
        await interaction.reply({ content: "You are not part of this game.", ephemeral: true }).catch(() => {});
        return;
      }

      if (interaction.user.id !== currentPlayer.id) {
        await interaction.reply({ content: `It is ${currentPlayer.username}'s turn.`, ephemeral: true }).catch(() => {});
        return;
      }

      const index = Number.parseInt(interaction.customId.split("_")[1], 10);
      if (Number.isNaN(index) || index < 0 || index > 8) {
        await interaction.reply({ content: "Invalid move.", ephemeral: true }).catch(() => {});
        return;
      }

      if (board[index] !== null) {
        await interaction.reply({ content: "That cell is already taken.", ephemeral: true }).catch(() => {});
        return;
      }

      board[index] = currentPlayer.id === player1.id ? "X" : "O";
      const winner = checkWinner();

      if (winner) {
        const winnerUser = winner === "X" ? player1 : player2;
        const winEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle("Game Over")
          .setDescription(`${winnerUser.username} wins.`)
          .addFields({ name: "Final Board", value: boardText() });

        await interaction.update({ embeds: [winEmbed], components: [] }).catch(() => {});
        collector.stop("completed");
        return;
      }

      if (isBoardFull()) {
        const drawEmbed = new EmbedBuilder()
          .setColor("#ffff00")
          .setTitle("Game Over")
          .setDescription("It is a draw.")
          .addFields({ name: "Final Board", value: boardText() });

        await interaction.update({ embeds: [drawEmbed], components: [] }).catch(() => {});
        collector.stop("completed");
        return;
      }

      currentPlayer = currentPlayer.id === player1.id ? player2 : player1;
      await interaction.update({ embeds: [createGameEmbed()], components: createGameButtons() }).catch(() => {});
    });

    collector.on("end", async (_collected, reason) => {
      if (reason === "time") {
        await gameMsg.edit({ content: "Game ended due to inactivity.", components: [] }).catch(() => {});
      }
    });
  }
};
