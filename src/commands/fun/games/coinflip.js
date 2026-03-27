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
  name: "coinflip",
  category: "fun",
  aliases: ["flip", "coin", "cf"],
  description: "Flip a coin and predict the outcome!",
  execute: async (ctx, args, client) => {
    const author = getAuthor(ctx);
    if (!author) return sendResponse(ctx, "Unable to resolve command user.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("coinflip_heads")
        .setLabel("Heads")
        .setEmoji("🪙")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("coinflip_tails")
        .setLabel("Tails")
        .setEmoji("🪙")
        .setStyle(ButtonStyle.Primary)
    );

    const container = new ContainerBuilder()
      .setAccentColor(client.embedColor || 0xff0011)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## 🪙 Coin Flip\nPick your prediction!"),
        new TextDisplayBuilder().setContent("Click a button to predict whether the coin will land on **Heads** or **Tails**!")
      );

    const msg = await sendResponse(ctx, { components: [withActionRows(container, row)] });
    if (!msg) return null;

    const filter = (i) => i.customId.startsWith("coinflip_") && i.user.id === author.id;
    const collector = msg.createMessageComponentCollector({ filter, time: 20000, max: 1 });

    collector.on("collect", async (interaction) => {
      const prediction = interaction.customId.split("_")[1];
      const result = Math.random() < 0.5 ? "heads" : "tails";
      const won = prediction === result;

      const resultContainer = new ContainerBuilder()
        .setAccentColor(won ? 0x2ecc71 : 0xe74c3c)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## 🪙 Result\n${won ? "✅ **YOU WIN!**" : "❌ **YOU LOSE!**"}`),
          new TextDisplayBuilder().setContent(`Your Prediction: **${prediction.toUpperCase()}**\nResult: **${result.toUpperCase()}**`)
        );

      await interaction.update({ components: [resultContainer] }).catch(() => {});
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        msg.edit({ components: [] }).catch(() => {});
      }
    });

    return null;
  }
};
