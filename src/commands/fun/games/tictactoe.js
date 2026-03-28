const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { safeReply, safeDeferReply } = require("../../../utils/interactionResponder");

module.exports = {
  name: "tictactoe",
  aliases: ["ttt", "tic-tac-toe"],
  category: "fun",
  description: "Play a game of Tic-Tac-Toe against the AI.",
  execute: async (ctx, _args, client) => {
    const isInteraction = typeof ctx?.isChatInputCommand === "function";
    const player = isInteraction ? ctx.user : ctx?.author;
    if (!player) return;

    const board = Array(9).fill(null);
    let gameActive = true;
    let statusText = "Your turn (X).";

    const winLines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6]
    ];

    const checkWinner = () => {
      for (const [a, b, c] of winLines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
      }
      return null;
    };

    const isBoardFull = () => board.every((cell) => cell !== null);

    const pickAiMove = () => {
      const open = board.map((cell, idx) => (cell === null ? idx : -1)).filter((idx) => idx >= 0);
      if (open.length === 0) return null;

      for (const idx of open) {
        board[idx] = "O";
        if (checkWinner() === "O") {
          board[idx] = null;
          return idx;
        }
        board[idx] = null;
      }

      for (const idx of open) {
        board[idx] = "X";
        if (checkWinner() === "X") {
          board[idx] = null;
          return idx;
        }
        board[idx] = null;
      }

      if (board[4] === null) return 4;
      const corners = [0, 2, 6, 8].filter((idx) => board[idx] === null);
      if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
      return open[Math.floor(Math.random() * open.length)];
    };

    const buildEmbed = () => {
      const boardText = board
        .map((cell, idx) => {
          if (cell === "X") return "X";
          if (cell === "O") return "O";
          return String(idx + 1);
        })
        .reduce((acc, cell, idx) => `${acc}${cell}${(idx + 1) % 3 === 0 ? "\n" : " | "}`, "");

      return new EmbedBuilder()
        .setColor(client?.embedColor || "#ff0051")
        .setTitle("Tic-Tac-Toe")
        .setDescription(`\`\`\`\n${boardText}\`\`\``)
        .addFields(
          { name: "Status", value: statusText, inline: false },
          { name: "Players", value: `X: ${player.username}\nO: AI`, inline: false }
        );
    };

    const buildButtons = (disabled = false) => {
      const rows = [];
      for (let row = 0; row < 3; row++) {
        const actionRow = new ActionRowBuilder();
        for (let col = 0; col < 3; col++) {
          const idx = row * 3 + col;
          actionRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`ttt_${idx}`)
              .setLabel(board[idx] || String(idx + 1))
              .setStyle(
                board[idx] === "X"
                  ? ButtonStyle.Danger
                  : board[idx] === "O"
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary
              )
              .setDisabled(disabled || !gameActive || board[idx] !== null)
          );
        }
        rows.push(actionRow);
      }
      return rows;
    };

    const messagePayload = {
      embeds: [buildEmbed()],
      components: buildButtons(),
    };

    let gameMessage = null;
    if (isInteraction) {
      const deferred = await safeDeferReply(ctx, { ephemeral: false });
      if (!deferred) {
        await safeReply(ctx, { content: "Could not start Tic-Tac-Toe right now." });
        return;
      }
      gameMessage = await safeReply(ctx, messagePayload);
    } else if (ctx?.channel?.send) {
      gameMessage = await ctx.channel.send({
        embeds: messagePayload.embeds,
        components: messagePayload.components
      });
    }

    if (!gameMessage || typeof gameMessage.createMessageComponentCollector !== "function") {
      if (isInteraction) await safeReply(ctx, { content: "Could not create the game board." });
      return;
    }

    const collector = gameMessage.createMessageComponentCollector({ time: 180000 });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.user.id !== player.id) {
        await safeReply(buttonInteraction, { content: "This is not your game.", ephemeral: true });
        return;
      }

      const idx = Number.parseInt(buttonInteraction.customId.split("_")[1], 10);
      if (!Number.isInteger(idx) || idx < 0 || idx > 8 || board[idx] !== null || !gameActive) {
        await buttonInteraction.deferUpdate().catch(() => {});
        return;
      }

      board[idx] = "X";
      let winner = checkWinner();
      if (winner === "X") {
        gameActive = false;
        statusText = "You win.";
        await buttonInteraction.update({ embeds: [buildEmbed()], components: buildButtons(true) }).catch(() => {});
        collector.stop("player_win");
        return;
      }

      if (isBoardFull()) {
        gameActive = false;
        statusText = "Draw.";
        await buttonInteraction.update({ embeds: [buildEmbed()], components: buildButtons(true) }).catch(() => {});
        collector.stop("draw");
        return;
      }

      const aiMove = pickAiMove();
      if (aiMove !== null) board[aiMove] = "O";

      winner = checkWinner();
      if (winner === "O") {
        gameActive = false;
        statusText = "AI wins.";
        await buttonInteraction.update({ embeds: [buildEmbed()], components: buildButtons(true) }).catch(() => {});
        collector.stop("ai_win");
        return;
      }

      if (isBoardFull()) {
        gameActive = false;
        statusText = "Draw.";
        await buttonInteraction.update({ embeds: [buildEmbed()], components: buildButtons(true) }).catch(() => {});
        collector.stop("draw");
        return;
      }

      statusText = "Your turn (X).";
      await buttonInteraction.update({ embeds: [buildEmbed()], components: buildButtons() }).catch(() => {});
    });

    collector.on("end", async (_collected, reason) => {
      if (gameActive && reason === "time") {
        statusText = "Game timed out.";
      }
      await gameMessage
        .edit({
          embeds: [buildEmbed()],
          components: buildButtons(true)
        })
        .catch(() => {});
    });
  }
};
