const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "coinflip",
    category: "fun",
    description: "Flip a coin!",
    execute: async (message, args, client, prefix) => {
        const result = Math.random() < 0.5 ? "Heads" : "Tails";
        
        const embed = new EmbedBuilder()
            .setColor(message.client?.embedColor || '#ff0051')
            .setTitle("Coin Flip")
            .setDescription(`The coin landed on **${result}**!`)
            .setFooter({ text: "Joker Music Fun Games" });

        message.channel.send({ embeds: [embed] });
    }
};
