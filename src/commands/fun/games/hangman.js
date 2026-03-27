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
  name: "hangman",
  category: "fun",
  aliases: ["hang"],
  description: "Classic Hangman game!",
  execute: async (ctx) => {
    const author = getAuthor(ctx);
    if (!author) return sendResponse(ctx, "Unable to resolve command user.");

    const words = ["discord", "javascript", "hangman", "programming", "developer", "gaming", "community", "awesome", "keyboard", "monitor"];
    const word = words[Math.floor(Math.random() * words.length)].toUpperCase().split("");
    const guessed = new Array(word.length).fill("_");
    const wrongGuesses = [];
    const correctGuesses = [];
    let attempts = 6;

    const hangmanStages = [
      "```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```",
      "```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```",
      "```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```",
      "```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```",
      "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```",
      "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```",
      "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```"
    ];

    const createGamePanel = () => {
      const container = new ContainerBuilder().setAccentColor(0x9b59b6);
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## 🎮 Hangman\nAttempts Left: **${attempts}**`),
        new TextDisplayBuilder().setContent(hangmanStages[6 - attempts]),
        new TextDisplayBuilder().setContent(
          `Word: \`${guessed.join(" ")}\`\n\n` +
          `✅ Correct: ${correctGuesses.length > 0 ? correctGuesses.join(", ") : "None"}\n` +
          `❌ Wrong: ${wrongGuesses.length > 0 ? wrongGuesses.join(", ") : "None"}`
        )
      );
      return container;
    };

    const getAlphabetButtons = () => {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
      const buttons = [];
      const guessedLetters = [...correctGuesses, ...wrongGuesses];

      for (let i = 0; i < alphabet.length; i += 5) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 5 && i + j < alphabet.length; j++) {
          const letter = alphabet[i + j];
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`hangman_${letter}`)
              .setLabel(letter)
              .setStyle(ButtonStyle.Primary)
              .setDisabled(guessedLetters.includes(letter))
          );
        }
        buttons.push(row);
      }
      return buttons;
    };

    const createGameComponents = () => [withActionRows(createGamePanel(), getAlphabetButtons())];

    const gameMsg = await sendResponse(ctx, { components: createGameComponents() });
    if (!gameMsg) return null;

    while (attempts > 0 && guessed.includes("_")) {
      const filter = (i) => i.customId.startsWith("hangman_") && i.user.id === author.id;
      const collector = gameMsg.createMessageComponentCollector({ filter, time: 30000, max: 1 });

      await new Promise((resolve) => {
        collector.on("collect", async (interaction) => {
          const letter = interaction.customId.split("_")[1];
          if (word.includes(letter)) {
            word.forEach((w, index) => {
              if (w === letter) guessed[index] = letter;
            });
            correctGuesses.push(letter);
          } else {
            wrongGuesses.push(letter);
            attempts--;
          }

          await interaction.deferUpdate().catch(() => {});
          await gameMsg.edit({ components: createGameComponents() }).catch(() => {});
          resolve();
        });

        collector.on("end", () => resolve());
      });
    }

    const endContainer = new ContainerBuilder().setAccentColor(guessed.includes("_") ? 0xe74c3c : 0x2ecc71);
    if (guessed.includes("_")) {
      endContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Game Over - LOST\nWord was: **${word.join("")}**`));
    } else {
      endContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Game Over - WON\n🎉 You guessed the word: **${word.join("")}**`));
    }

    await gameMsg.edit({ components: [endContainer] }).catch(() => {});
    return null;
  }
};
