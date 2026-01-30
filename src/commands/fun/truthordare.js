const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "truthordare",
  category: "fun",
  aliases: ["tod"],
  description: "Play a game of Truth or Dare!",
  execute: async (message, args, client, prefix) => {
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
      "If you could be anyone else for a day, who would it be?"
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
      "Send a message to your crush (if you dare!)."
    ];

    const type = args[0]?.toLowerCase();

    if (type === "truth") {
      const truth = truths[Math.floor(Math.random() * truths.length)];
      const embed = new EmbedBuilder()
        .setTitle("Truth")
        .setDescription(truth)
        .setColor(0xff0051)
        .setFooter({ text: `Requested by ${message.author.tag}` });
      return message.channel.send({ embeds: [embed] });
    }

    if (type === "dare") {
      const dare = dares[Math.floor(Math.random() * dares.length)];
      const embed = new EmbedBuilder()
        .setTitle("Dare")
        .setDescription(dare)
        .setColor(0xff0051)
        .setFooter({ text: `Requested by ${message.author.tag}` });
      return message.channel.send({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setTitle("Truth or Dare")
      .setDescription(`Please choose either **truth** or **dare**.\nExample: \`${prefix}tod truth\``)
      .setColor(0xff0051);
    message.channel.send({ embeds: [embed] });
  }
};