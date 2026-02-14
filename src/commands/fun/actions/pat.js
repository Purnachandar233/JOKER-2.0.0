const { EmbedBuilder } = require("discord.js");

// Valid anime pat GIF URLs from Tenor
const patGifs = [
    "https://media.tenor.com/5Hx9K2W7PnMAAAAC/pat-anime.gif",
    "https://media.tenor.com/1LkM4N8Q3RwAAAAC/pat.gif",
    "https://media.tenor.com/V7pR5Y2T9KjAAAAC/anime-pat.gif",
    "https://media.tenor.com/Z3sX8K6L1QwAAAAC/pat-sasuke.gif",
    "https://media.tenor.com/C9tY7M4N2VpAAAAC/pat-nezuko.gif"
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
    name: "pat",
    category: "fun",
    description: "Give someone a gentle pat!",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.reply("Please mention someone to pat! 🤗");
        }

        if (user.id === message.author.id) {
            return message.reply("You can't pat yourself! 😄");
        }

        const randomGif = patGifs[Math.floor(Math.random() * patGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#ffd700")
            .setTitle(`${message.author.username} pats ${user.username}`)
            .setDescription(`${message.author.username} gently pats ${user.username} on the head! 🥰`)
            .setImage(randomGif)
            .setFooter({ text: "Joker Music • Action Command" });

        message.channel.send({ embeds: [embed] });
    }
};
