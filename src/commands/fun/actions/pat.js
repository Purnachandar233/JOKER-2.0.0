const { EmbedBuilder } = require("discord.js");

// Verified working anime romantic pat/headpat GIFs
const patGifs = [
    "https://media.giphy.com/media/l0HlQaQ5jcKxaiEPm/giphy.gif",  // Cute romantic headpat
    "https://media.giphy.com/media/xTiTnkk3x12LvAjqPu/giphy.gif",  // Affectionate pat
    "https://media.giphy.com/media/v2LYL3dw3i3OwH94L5/giphy.gif",  // Tender moment
    "https://media.giphy.com/media/3o7TKU8gNS9TQfm8OI/giphy.gif",  // Romantic pat
    "https://media.giphy.com/media/iKBAAfYNgnXSozLVyn/giphy.gif"  // Sweet headpat
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
    aliases: ["headpat", "pats"],
    category: "fun",
    description: "Give someone a gentle pat!",
    usage: "pat @user",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.channel.send("Please mention someone to pat! 🤗");
        }

        if (user.id === message.author.id) {
            return message.channel.send("You can't pat yourself! 😄");
        }

        const randomGif = patGifs[Math.floor(Math.random() * patGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#ffd700")
            .setTitle(`${message.author.username} pats ${user.username}`)
            .setDescription(`${message.author.username} gently pats ${user.username} on the head! 🥰`)
            .setImage(randomGif);

        message.channel.send({ embeds: [embed] });
    }
};
