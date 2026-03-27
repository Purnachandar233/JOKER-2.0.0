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
  name: "quiz",
  category: "fun",
  aliases: ["trivia"],
  description: "Battle royale trivia quiz!",
  execute: async (ctx) => {
    const author = getAuthor(ctx);
    if (!author) return sendResponse(ctx, "Unable to resolve command user.");

    const questions = [
      { q: "What is the capital of France?", a: "a", options: ["Paris", "London", "Berlin", "Madrid"] },
      { q: "What is 2 + 2?", a: "a", options: ["4", "3", "5", "6"] },
      { q: "What color is the sky?", a: "a", options: ["Blue", "Red", "Green", "Yellow"] },
      { q: "What is the largest planet?", a: "a", options: ["Jupiter", "Saturn", "Mars", "Venus"] },
      { q: "Who wrote Romeo and Juliet?", a: "a", options: ["Shakespeare", "Marlowe", "Dante", "Cervantes"] }
    ];

    let current = 0;
    let score = 0;

    const createQuizPanel = (showAnswer = false, correct = false) => {
      if (current >= questions.length) {
        return new ContainerBuilder()
          .setAccentColor(0x2ecc71)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## Quiz Complete!\n**Final Score: ${score}/${questions.length}**\n\nThat's **${Math.round((score / questions.length) * 100)}%**!`)
          );
      }

      const q = questions[current];
      const colorCode = showAnswer ? (correct ? 0x2ecc71 : 0xe74c3c) : 0x3498db;
      const statusLine = showAnswer ? (correct ? "✅ Correct!" : "❌ Wrong!") : `Question ${current + 1}/${questions.length}`;

      return new ContainerBuilder()
        .setAccentColor(colorCode)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## 📚 Quiz\n${statusLine}`),
          new TextDisplayBuilder().setContent(`**${q.q}**\n\nScore: ${score}`),
          new TextDisplayBuilder().setContent(showAnswer && !correct ? `Correct answer: **${q.options[0]}**` : "Click an answer below!")
        );
    };

    const createAnswerButtons = () => {
      const q = questions[current];
      const row = new ActionRowBuilder();
      q.options.forEach((option, index) => {
        const letter = String.fromCharCode(97 + index);
        row.addComponents(new ButtonBuilder().setCustomId(`quiz_${letter}`).setLabel(option).setStyle(ButtonStyle.Primary));
      });
      return row;
    };

    const createQuestionComponents = (showAnswer = false, correct = false) => (
      [withActionRows(createQuizPanel(showAnswer, correct), createAnswerButtons())]
    );

    const gameMsg = await sendResponse(ctx, { components: createQuestionComponents() });
    if (!gameMsg) return null;

    while (current < questions.length) {
      const filter = (i) => i.customId.startsWith("quiz_") && i.user.id === author.id;
      const collector = gameMsg.createMessageComponentCollector({ filter, time: 15000, max: 1 });

      await new Promise((resolve) => {
        collector.on("collect", async (interaction) => {
          const answer = interaction.customId.split("_")[1];
          const isCorrect = answer === questions[current].a;
          if (isCorrect) score++;

          await interaction.deferUpdate().catch(() => {});
          await gameMsg.edit({ components: createQuestionComponents(true, isCorrect) }).catch(() => {});

          setTimeout(() => {
            current++;
            if (current < questions.length) {
              gameMsg.edit({ components: createQuestionComponents() }).catch(() => {});
            } else {
              gameMsg.edit({ components: [createQuizPanel()] }).catch(() => {});
            }
          }, 2000);

          resolve();
        });

        collector.on("end", () => {
          if (current < questions.length) {
            current++;
            if (current < questions.length) {
              gameMsg.edit({ components: createQuestionComponents() }).catch(() => {});
            }
          }
          resolve();
        });
      });
    }

    return null;
  }
};
