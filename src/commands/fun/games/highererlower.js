const { ContainerBuilder, TextDisplayBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { safeReply } = require("../../../utils/interactionResponder");

function isInteraction(ctx) {
  return Boolean(ctx && typeof ctx.deferReply === "function" && typeof ctx.editReply === "function");
}

function getAuthor(ctx) {
  return ctx?.author || ctx?.user || null;
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
  name: "highererlower",
  category: "fun",
  aliases: ["hol"],
  description: "Guess if the next number is higher or lower!",
  execute: async (ctx) => {
    const author = getAuthor(ctx);
    if (!author) return sendResponse(ctx, "Unable to resolve command user.");

    let currentNum = Math.floor(Math.random() * 100) + 1;
    let score = 0;
    let gameActive = true;

    const getNextNum = () => Math.floor(Math.random() * 100) + 1;

    const createGamePanel = (status = "Make your guess!") => {
      const container = new ContainerBuilder().setAccentColor(0x3498db);
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## 🎯 Higher or Lower\nScore: **${score}**`),
        new TextDisplayBuilder().setContent(`Current Number: **${currentNum}**\n\nWill the next number be higher or lower?`),
        new TextDisplayBuilder().setContent(status)
      );
      return container;
    };

    const createChoiceButtons = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("hol_higher").setLabel("Higher").setEmoji("📈").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("hol_lower").setLabel("Lower").setEmoji("📉").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("hol_quit").setLabel("Quit").setEmoji("❌").setStyle(ButtonStyle.Secondary)
    );

    const gameMsg = await sendResponse(ctx, { components: [withActionRows(createGamePanel(), createChoiceButtons())] });
    if (!gameMsg) return null;

    const playRound = () => new Promise((resolve) => {
      const filter = (i) => i.customId.startsWith("hol_") && i.user.id === author.id;
      const collector = gameMsg.createMessageComponentCollector({ filter, time: 30000, max: 1 });

      collector.on("collect", async (interaction) => {
        const choice = interaction.customId.split("_")[1];

        if (choice === "quit") {
          gameActive = false;
          const endContainer = new ContainerBuilder().setAccentColor(0x95a5a6);
          endContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Game Over\nFinal Score: **${score}**`));
          await interaction.update({ components: [endContainer] }).catch(() => {});
          resolve();
          return;
        }

        const nextNum = getNextNum();
        const isCorrect = (choice === "higher" && nextNum > currentNum) || (choice === "lower" && nextNum < currentNum);

        if (isCorrect) {
          score++;
          currentNum = nextNum;
          await interaction.update({
            components: [withActionRows(createGamePanel(`✅ Correct! The number was **${nextNum}**!\nScore increased to **${score}**!`), createChoiceButtons())]
          }).catch(() => {});
        } else {
          gameActive = false;
          const endContainer = new ContainerBuilder().setAccentColor(0xe74c3c);
          endContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## Game Over\n❌ Wrong! The number was **${nextNum}**.\nFinal Score: **${score}**`)
          );
          await interaction.update({ components: [endContainer] }).catch(() => {});
        }

        resolve();
      });

      collector.on("end", () => resolve());
    });

    while (gameActive) {
      await playRound();
    }
    return null;
  }
};
