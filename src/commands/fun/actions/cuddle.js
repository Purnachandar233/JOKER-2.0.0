const { EmbedBuilder } = require("discord.js");

// Valid anime cuddle GIF URLs from Tenor
const cuddleGifs = [
    "https://media.tenor.com/6Hx8K3W7PnMAAAAC/cuddle-anime.gif",
    "https://media.tenor.com/8LkM4N9Q5RwAAAAC/cuddle.gif",
    "https://media.tenor.com/W9pR7Y3T5KjAAAAC/anime-cuddle.gif",
    "https://media.tenor.com/A4sY9K7L1QwAAAAC/cuddle-naruto.gif",
    "https://media.tenor.com/D0tY8M5N2VpAAAAC/cuddle-nezuko.gif"
];

// Helper function to get first mentioned user from both Collection and Map
function getFirstMentionedUser(message, args, client) {
    if (message.mentions.users.first) {
        // It's a Collection (normal message)
        return message.mentions.users.first() || client.users.cache.get(args[0]);
    } else if (message.mentions.users instanceof Map) {
        // It's a Map (from slash command)
        return message.mentions.users.values().next().value || client.users.cache.get(args[0]);
    }
    return client.users.cache.get(args[0]);
}

module.exports = {
    name: "cuddle",
    category: "fun",
    description: "Cuddle with someone!",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.reply("Please mention someone to cuddle! 🧸");
        }

        if (user.id === message.author.id) {
            return message.reply("You can't cuddle yourself! 😔");
        }

        const randomGif = cuddleGifs[Math.floor(Math.random() * cuddleGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#ff69b4")
            .setTitle(`${message.author.username} cuddles ${user.username}`)
            .setDescription(`${message.author.username} and ${user.username} share a cozy cuddle! So sweet! 🧸`)
            .setImage(randomGif)
            .setFooter({ text: "Joker Music • Action Command" });

        message.channel.send({ embeds: [embed] });
    }
};
