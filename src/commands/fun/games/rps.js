const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "rps",
    category: "fun",
    description: "Play Rock Paper Scissors with the bot!",
    execute: async (message, args, client, prefix) => {
        const choices = ["rock", "paper", "scissors"];
        const userChoice = args[0]?.toLowerCase();

        if (!userChoice || !choices.includes(userChoice)) {
            return message.reply("Please choose either `rock`, `paper`, or `scissors`!");
        }

        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        let result = "";

        if (userChoice === botChoice) result = "It's a tie!";
        else if (
            (userChoice === "rock" && botChoice === "scissors") ||
            (userChoice === "paper" && botChoice === "rock") ||
            (userChoice === "scissors" && botChoice === "paper")
        ) {
            result = "You win!";
        } else {
            result = "You lose!";
        }

        const embed = new EmbedBuilder()
            .setColor(message.client?.embedColor || '#ff0051')
            .setTitle("Rock Paper Scissors")
            .addFields(
                { name: "Your Choice", value: userChoice, inline: true },
                { name: "Bot Choice", value: botChoice, inline: true },
                { name: "Result", value: result }
            )
            .setFooter({ text: "Joker Music Fun Games" });

        message.channel.send({ embeds: [embed] });
    }
};
