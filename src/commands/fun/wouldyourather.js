const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "wouldyourather",
  category: "fun",
  aliases: ["wyr"],
  description: "Play a game of Would You Rather!",
  execute: async (message, args, client, prefix) => {
    const questions = [
      "Would you rather be able to fly or be invisible?",
      "Would you rather always have to sing instead of speaking or always have to dance everywhere you go?",
      "Would you rather be the smartest person in the world or the richest?",
      "Would you rather have a pet dinosaur or a pet dragon?",
      "Would you rather live in a world with magic or a world with advanced technology?",
      "Would you rather be able to talk to animals or speak all human languages?",
      "Would you rather travel to the past or the future?",
      "Would you rather never have to sleep again or never have to eat again?",
      "Would you rather be a famous actor or a famous singer?",
      "Would you rather live on a desert island or in a crowded city?"
    ];

    const question = questions[Math.floor(Math.random() * questions.length)];
    const embed = new EmbedBuilder()
      .setTitle("Would You Rather")
      .setDescription(question)
      .setColor(0xff0051)
      .setFooter({ text: `Requested by ${message.author.tag}` });
    
    message.channel.send({ embeds: [embed] });
  }
};