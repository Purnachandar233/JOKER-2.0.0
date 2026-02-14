const { EmbedBuilder } = require("discord.js");

// Verified working anime romantic cuddle GIFs
const cuddleGifs = [
    "https://media.giphy.com/media/L95W4z3PSpLT60Opie/giphy.gif",  // Romantic anime cuddle
    "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",  // Couple cuddle moment
    "https://media.giphy.com/media/3o7TKU8gNS9TQfm8OI/giphy.gif",  // Affectionate cuddle
    "https://media.giphy.com/media/l0HlN9Q0kYWd74nAQ/giphy.gif",  // Sweet embrace
    "https://media.giphy.com/media/iKBAAfYNgnXSozLVyn/giphy.gif"  // Romantic moment
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
    aliases: ["cuddleup", "snuggle"],
    usage: "cuddle @user",
    category: "fun",
    description: "Cuddle with someone!",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.channel.send("Please mention someone to cuddle! 🧸");
        }

        if (user.id === message.author.id) {
            return message.channel.send("You can't cuddle yourself! 😔");
        }

        const randomGif = cuddleGifs[Math.floor(Math.random() * cuddleGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#ff69b4")
            .setTitle(`${message.author.username} cuddles ${user.username}`)
            .setDescription(`${message.author.username} and ${user.username} share a cozy cuddle! So sweet! 🧸`)
            .setImage(randomGif);

        message.channel.send({ embeds: [embed] });
    }
};
