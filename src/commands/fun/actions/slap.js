const { EmbedBuilder } = require("discord.js");

// Valid anime slap GIF URLs from Tenor
const slapGifs = [
    "https://media.tenor.com/bQa4fYG_JlYAAAAC/slap-anime.gif",
    "https://media.tenor.com/7xTkG5Z2tZMAAAAC/slap.gif",
    "https://media.tenor.com/kVZ7YhT2QHsAAAAC/anime-slap.gif",
    "https://media.tenor.com/P9kRZ5Y6xNcAAAAC/slap-kyouka.gif",
    "https://media.tenor.com/x8vN9K3pLp0AAAAC/slap-madara.gif"
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
    name: "slap",
    category: "fun",
    description: "Give someone a playful slap!",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.reply("Please mention someone to slap! 😅");
        }

        if (user.id === message.author.id) {
            return message.reply("You can't slap yourself! 🙈");
        }

        const randomGif = slapGifs[Math.floor(Math.random() * slapGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#ff6b6b")
            .setTitle(`${message.author.username} slaps ${user.username}`)
            .setDescription(`${user.username} just received a playful slap from ${message.author.username}! 🤚`)
            .setImage(randomGif)
            .setFooter({ text: "Joker Music • Action Command" });

        message.channel.send({ embeds: [embed] });
    }
};
