const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { safeReply } = require("../../../utils/interactionResponder");

function isInteraction(ctx) {
  return Boolean(ctx && typeof ctx.deferReply === "function" && typeof ctx.editReply === "function");
}

function getAuthor(ctx) {
  return ctx?.author || ctx?.user || null;
}

async function sendResponse(ctx, payload) {
  if (isInteraction(ctx)) {
    const normalized = typeof payload === "string" ? { content: payload } : payload;
    return safeReply(ctx, normalized);
  }
  return ctx.channel.send(payload);
}

module.exports = {
  name: "truthordare",
  category: "fun",
  aliases: ["tod"],
  description: "Play a game of Truth or Dare!",
  execute: async (ctx, args, client) => {
    const author = getAuthor(ctx);
    if (!author) return sendResponse(ctx, "Unable to resolve command user.");

    const truths = [
      "What is your biggest fear?",
      "What is the most embarrassing thing you've ever done?",
      "What is a secret you've never told anyone?",
      "Who is your secret crush?",
      "What is the biggest lie you've ever told?",
      "What is your most annoying habit?",
      "Have you ever cheated on a test?",
      "What is the meanest thing you've ever said to someone?",
      "What is your biggest regret?",
      "If you could be anyone else for a day, who would it be?",
      "What's the worst mistake you've made?",
      "What is the worst date you've ever been on?"
    ];

    const dares = [
      "Do 20 pushups.",
      "Sing a song loudly in the voice channel.",
      "Send a random meme in the chat.",
      "Tell a joke that makes everyone laugh.",
      "Bark like a dog for 30 seconds.",
      "Type a sentence using only your nose.",
      "Post an embarrassing photo of yourself (if you're comfortable).",
      "Do your best impression of someone in the chat.",
      "Dance for 1 minute without music.",
      "Send a message to your crush (if you dare!).",
      "Write a love poem about Discord.",
      "Speak in an accent for the next 5 messages."
    ];

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("tod_truth").setLabel("Truth").setEmoji("🎤").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("tod_dare").setLabel("Dare").setEmoji("🎯").setStyle(ButtonStyle.Danger)
    );

    const startEmbed = new EmbedBuilder()
      .setTitle("🎭 Truth or Dare")
      .setDescription("Choose your challenge!")
      .setColor(client.embedColor || "#e74c3c");

    const msg = await sendResponse(ctx, { embeds: [startEmbed], components: [row] });
    if (!msg) return null;

    const filter = (i) => i.customId.startsWith("tod_");
    const collector = msg.createMessageComponentCollector({ filter, time: 20000, max: 1 });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== author.id) {
        await safeReply(interaction, { content: `Only <@${author.id}> can use these buttons.`, ephemeral: true });
        return;
      }

      const choice = interaction.customId.split("_")[1];
      const isTruth = choice === "truth";
      const content = isTruth ? truths[Math.floor(Math.random() * truths.length)] : dares[Math.floor(Math.random() * dares.length)];
      const emoji = isTruth ? "🎤" : "🎯";

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${choice.charAt(0).toUpperCase() + choice.slice(1)}`)
        .setDescription(content)
        .setColor(isTruth ? "#3498db" : "#e74c3c");

      await interaction.update({ embeds: [embed], components: [] }).catch(() => {});
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        msg.edit({ content: "Game cancelled due to inactivity.", components: [] }).catch(() => {});
      }
    });

    return null;
  }
};
