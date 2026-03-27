const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { safeReply } = require("../../../utils/interactionResponder");

function isInteraction(ctx) {
  return Boolean(ctx && typeof ctx.deferReply === "function" && typeof ctx.editReply === "function");
}

async function sendResponse(ctx, payload) {
  if (isInteraction(ctx)) {
    const normalized = typeof payload === "string" ? { content: payload } : payload;
    return safeReply(ctx, normalized);
  }
  return ctx.channel.send(payload);
}

module.exports = {
  name: "wouldyourather",
  category: "fun",
  aliases: ["wyr"],
  description: "Play a game of Would You Rather!",
  execute: async (ctx, args, client) => {
    const questions = [
      { question: "Would you rather be able to fly or be invisible?", option1: "✈️ Fly", option2: "👻 Invisible" },
      { question: "Would you rather always have to sing instead of speaking or always have to dance everywhere you go?", option1: "🎤 Sing", option2: "💃 Dance" },
      { question: "Would you rather be the smartest person in the world or the richest?", option1: "🧠 Smartest", option2: "💰 Richest" },
      { question: "Would you rather have a pet dinosaur or a pet dragon?", option1: "🦕 Dinosaur", option2: "🐉 Dragon" },
      { question: "Would you rather live in a world with magic or a world with advanced technology?", option1: "✨ Magic", option2: "⚙️ Technology" },
      { question: "Would you rather be able to talk to animals or speak all human languages?", option1: "🐾 Talk to Animals", option2: "🌍 All Languages" },
      { question: "Would you rather travel to the past or the future?", option1: "⏰ Past", option2: "🚀 Future" },
      { question: "Would you rather never have to sleep again or never have to eat again?", option1: "😴 No Sleep", option2: "🍽️ No Food" },
      { question: "Would you rather be a famous actor or a famous singer?", option1: "🎬 Actor", option2: "🎵 Singer" },
      { question: "Would you rather live on a desert island or in a crowded city?", option1: "🏝️ Desert Island", option2: "🏙️ Crowded City" }
    ];

    const q = questions[Math.floor(Math.random() * questions.length)];
    const votes = { option1: 0, option2: 0 };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("wyr_option1").setLabel(q.option1).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("wyr_option2").setLabel(q.option2).setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle("❓ Would You Rather")
      .setDescription(q.question)
      .setColor(client.embedColor || "#9b59b6")
      .addFields(
        { name: "Option 1", value: q.option1, inline: true },
        { name: "Option 2", value: q.option2, inline: true },
        { name: "Votes", value: `${q.option1}: **${votes.option1}** | ${q.option2}: **${votes.option2}**`, inline: false }
      );

    const msg = await sendResponse(ctx, { embeds: [embed], components: [row] });
    if (!msg) return null;

    const filter = (i) => i.customId.startsWith("wyr_");
    const collector = msg.createMessageComponentCollector({ filter, time: 60000 });
    const voters = new Set();

    collector.on("collect", async (interaction) => {
      if (voters.has(interaction.user.id)) {
        return safeReply(interaction, { content: "You've already voted!", ephemeral: true });
      }

      voters.add(interaction.user.id);
      if (interaction.customId === "wyr_option1") votes.option1++;
      else votes.option2++;

      const updatedEmbed = new EmbedBuilder()
        .setTitle("❓ Would You Rather")
        .setDescription(q.question)
        .setColor(client.embedColor || "#9b59b6")
        .addFields(
          { name: "Option 1", value: q.option1, inline: true },
          { name: "Option 2", value: q.option2, inline: true },
          { name: "Votes", value: `${q.option1}: **${votes.option1}** | ${q.option2}: **${votes.option2}**`, inline: false }
        );

      await interaction.deferUpdate().catch(() => {});
      await msg.edit({ embeds: [updatedEmbed] }).catch(() => {});
    });

    collector.on("end", async () => {
      const winner = votes.option1 > votes.option2 ? q.option1 : votes.option2 > votes.option1 ? q.option2 : "Tie!";
      const finalEmbed = new EmbedBuilder()
        .setTitle("📊 Results")
        .setColor("#f1c40f")
        .addFields(
          { name: q.option1, value: `**${votes.option1}** votes`, inline: true },
          { name: q.option2, value: `**${votes.option2}** votes`, inline: true },
          { name: "Winner", value: winner, inline: false }
        );

      await msg.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
    });

    return null;
  }
};
