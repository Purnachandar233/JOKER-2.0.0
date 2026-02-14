const { EmbedBuilder } = require("discord.js");

// Verified working anime highfive GIFs
const highfiveGifs = [
    "https://media.giphy.com/media/3o7TKU8gNS9TQfm8OI/giphy.gif",  // Anime highfive celebration
    "https://media.giphy.com/media/l0HlN9Q0kYWd74nAQ/giphy.gif",   // Happy highfive
    "https://media.giphy.com/media/v2LYL3dw3i3OwH94L5/giphy.gif",  // Enthusiastic highfive
    "https://media.giphy.com/media/iKBAAfYNgnXSozLVyn/giphy.gif",   // Victory highfive
    "https://media.giphy.com/media/L95W4z3PSpLT60Opie/giphy.gif"   // Success highfive
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
    name: "highfive",
    aliases: ["hf", "high5"],
    category: "fun",
    description: "Give someone a high five!",
    usage: "highfive @user",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.channel.send("Please mention someone to high five! ✋");
        }

        if (user.id === message.author.id) {
            return message.channel.send("You can't high five yourself! 😄");
        }

        const randomGif = highfiveGifs[Math.floor(Math.random() * highfiveGifs.length)];

        const embed = new EmbedBuilder()
            .setColor(client?.embedColor || '#ff0051')
            .setTitle(`${message.author.username} high fives ${user.username}`)
            .setDescription(`${message.author.username} and ${user.username} high five! That's awesome! ✋`)
            .setImage(randomGif);

        message.channel.send({ embeds: [embed] });
    }
};
