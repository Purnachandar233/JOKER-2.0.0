const { EmbedBuilder } = require("discord.js");

// Valid anime highfive GIF URLs from Tenor
const highfiveGifs = [
    "https://media.tenor.com/2Fk8W5X7nLsAAAAC/highfive-anime.gif",
    "https://media.tenor.com/9LmN3K6P8QrAAAAC/highfive.gif",
    "https://media.tenor.com/H7jR2Y9T4XsAAAAC/anime-highfive.gif",
    "https://media.tenor.com/K3pQ6W8V1YzAAAAC/highfive-naruto.gif",
    "https://media.tenor.com/O8vT4X2M9LkAAAAC/highfive-hinata.gif"
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
    category: "fun",
    description: "Give someone a high five!",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.reply("Please mention someone to high five! ✋");
        }

        if (user.id === message.author.id) {
            return message.reply("You can't high five yourself! 😄");
        }

        const randomGif = highfiveGifs[Math.floor(Math.random() * highfiveGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#32cd32")
            .setTitle(`${message.author.username} high fives ${user.username}`)
            .setDescription(`${message.author.username} and ${user.username} high five! That's awesome! ✋`)
            .setImage(randomGif)
            .setFooter({ text: "Joker Music • Action Command" });

        message.channel.send({ embeds: [embed] });
    }
};
