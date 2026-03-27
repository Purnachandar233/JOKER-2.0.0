const { ContainerBuilder, TextDisplayBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { safeReply } = require("../../../utils/interactionResponder");

function isInteraction(ctx) {
  return Boolean(ctx && typeof ctx.deferReply === "function" && typeof ctx.editReply === "function");
}

function getAuthor(ctx) {
  return ctx?.author || ctx?.user || null;
}

function getOpponent(ctx, args, client) {
  if (isInteraction(ctx)) {
    const optionUser = ctx.options?.getUser?.("opponent");
    if (optionUser) return optionUser;
  }

  const users = ctx?.mentions?.users;
  if (users?.first) return users.first() || (args[0] ? client.users.cache.get(args[0]) : null);
  if (users instanceof Map) return users.values().next().value || (args[0] ? client.users.cache.get(args[0]) : null);
  return args[0] ? client.users.cache.get(args[0]) : null;
}

async function sendResponse(ctx, payload) {
  const normalized = typeof payload === "string" ? { content: payload } : { ...(payload || {}) };
  const usesComponentsV2 = Array.isArray(normalized.components) && normalized.components.some((component) => {
    const type = component?.data?.type || component?.toJSON?.().type || null;
    return type !== 1;
  });

  if (usesComponentsV2 && normalized.flags == null) {
    normalized.flags = MessageFlags.IsComponentsV2;
  }

  if (isInteraction(ctx)) {
    return safeReply(ctx, normalized);
  }
  return ctx.channel.send(normalized);
}

function withActionRows(container, ...rows) {
  for (const row of rows.flat().filter(Boolean)) {
    container.addActionRowComponents(row);
  }
  return container;
}

module.exports = {
  name: "rps",
  category: "fun",
  aliases: ["rockpaperscissors"],
  description: "Play Rock Paper Scissors Multiplayer with buttons!",
  execute: async (ctx, args, client, prefix) => {
    const author = getAuthor(ctx);
    if (!author) return sendResponse(ctx, "Unable to resolve command user.");

    const opponent = getOpponent(ctx, args, client);
    if (!opponent) {
      return sendResponse(ctx, `Please mention a player to play against! Example: \`${prefix || "="}rps @user\``);
    }
    if (opponent.id === author.id) {
      return sendResponse(ctx, "You can't play against yourself!");
    }

    let player1Choice = null;
    let player2Choice = null;
    let player1Score = 0;
    let player2Score = 0;
    let roundNumber = 1;
    const maxRounds = 3;

    const choiceEmojis = {
      rock: "🪨",
      paper: "📄",
      scissors: "✂️"
    };

    const determineWinner = () => {
      if (player1Choice === player2Choice) return "tie";
      if (player1Choice === "rock") return player2Choice === "scissors" ? "player1" : "player2";
      if (player1Choice === "paper") return player2Choice === "rock" ? "player1" : "player2";
      if (player1Choice === "scissors") return player2Choice === "paper" ? "player1" : "player2";
      return "tie";
    };

    const createRoundPanel = (status = "Waiting for choices...") => {
      const container = new ContainerBuilder().setAccentColor(0xff0051);
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## 🎮 Rock Paper Scissors\n**Round ${roundNumber}/${maxRounds}**`),
        new TextDisplayBuilder().setContent(
          `${author.username} vs ${opponent.username}\n\n` +
          `${author.username}: ${player1Choice ? choiceEmojis[player1Choice] : "❓"}\n` +
          `${opponent.username}: ${player2Choice ? choiceEmojis[player2Choice] : "❓"}\n\n` +
          `**Score:** ${player1Score} - ${player2Score}`
        ),
        new TextDisplayBuilder().setContent(status)
      );
      return container;
    };

    const createChoiceButtons = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("rps_rock").setLabel("Rock").setEmoji("🪨").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("rps_paper").setLabel("Paper").setEmoji("📄").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("rps_scissors").setLabel("Scissors").setEmoji("✂️").setStyle(ButtonStyle.Primary)
    );

    const gameMsg = await sendResponse(ctx, { components: [withActionRows(createRoundPanel(), createChoiceButtons())] });
    if (!gameMsg) return null;

    const playRound = () => new Promise((resolve) => {
      player1Choice = null;
      player2Choice = null;

      const filter = (i) => i.customId.startsWith("rps_") && (i.user.id === author.id || i.user.id === opponent.id);
      const collector = gameMsg.createMessageComponentCollector({ filter, time: 30000 });
      let choiceMade = 0;

      collector.on("collect", async (interaction) => {
        const choice = interaction.customId.split("_")[1];
        if (interaction.user.id === author.id) player1Choice = choice;
        else player2Choice = choice;

        choiceMade++;
        await interaction.deferUpdate().catch(() => {});

        if (choiceMade === 2) {
          collector.stop();
          resolve();
        }
      });

      collector.on("end", () => resolve());
    });

    for (roundNumber = 1; roundNumber <= maxRounds; roundNumber++) {
      await playRound();

      if (!player1Choice || !player2Choice) {
        await gameMsg.edit({ components: [createRoundPanel("⏱️ Time's up! Both players must choose.")] }).catch(() => {});
        return null;
      }

      const result = determineWinner();
      let resultText = "";
      if (result === "tie") resultText = "🤝 It's a tie!";
      else if (result === "player1") {
        player1Score++;
        resultText = `🎉 ${author.username} wins this round!`;
      } else {
        player2Score++;
        resultText = `🎉 ${opponent.username} wins this round!`;
      }

      await gameMsg.edit({ components: [withActionRows(createRoundPanel(resultText), createChoiceButtons())] }).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    const winner = player1Score > player2Score ? author.username : player2Score > player1Score ? opponent.username : "Nobody";
    const finalStatus = winner === "Nobody" ? "🤝 It's a draw!" : `🏆 ${winner} wins the game!`;

    await gameMsg.edit({ components: [createRoundPanel(finalStatus)] }).catch(() => {});
    return null;
  }
};
