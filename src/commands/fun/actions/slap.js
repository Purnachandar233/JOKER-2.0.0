const { EmbedBuilder } = require("discord.js");

// Valid anime slap GIF URLs - Updated working sources
const slapGifs = [
    "https://media1.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif",
    "https://media1.giphy.com/media/v2LYL3dw3i3OwH94L5/giphy.gif",
    "https://media2.giphy.com/media/xTiTnkk3x12LvAjqPu/giphy.gif",
    "https://media3.giphy.com/media/5xtDarE6XC3gN4bB4KU/giphy.gif",
    "https://media4.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif"
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
