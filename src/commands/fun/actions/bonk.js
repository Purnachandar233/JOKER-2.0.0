const { EmbedBuilder } = require("discord.js");

// Valid anime bonk GIF URLs from Tenor
const bonkGifs = [
    "https://media.tenor.com/0V1uR5qjlFwAAAAC/boi%21-bonk.gif",
    "https://media.tenor.com/2Yv3K6gGCfMAAAAC/bonk.gif",
    "https://media.tenor.com/Jz7mQPfN2vUAAAAC/anime-eyes.gif",
    "https://media.tenor.com/tHks8N8YcZoAAAAC/katou-megumi-bonk.gif",
    "https://media.tenor.com/L0xS4c-2B_gAAAAC/bunny-girl-senpai-bonk.gif"
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
    name: "bonk",
    category: "fun",
    description: "Bonk someone to horny jail!",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.reply("Please mention someone to bonk! 🔨");
        }

        if (user.id === message.author.id) {
            return message.reply("Don't bonk yourself! 😅");
        }

        const randomGif = bonkGifs[Math.floor(Math.random() * bonkGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#8b4513")
            .setTitle(`${message.author.username} bonks ${user.username}`)
            .setDescription(`${user.username} has been sent to horny jail by ${message.author.username}! 🔨`)
            .setImage(randomGif)
            

        message.channel.send({ embeds: [embed] });
    }
};
