const { EmbedBuilder } = require("discord.js");

// Valid anime hug GIF URLs from Tenor
const hugGifs = [
    "https://media.tenor.com/4Hk8W2X6PmNAAAAC/hug-anime.gif",
    "https://media.tenor.com/7LkM3N9Q5RwAAAAC/hug.gif",
    "https://media.tenor.com/V8pR6Y2T4KjAAAAC/anime-hug.gif",
    "https://media.tenor.com/Z3sX9K7L1QwAAAAC/hug-naruto.gif",
    "https://media.tenor.com/C9tY8M5N2VpAAAAC/hug-sasuke.gif"
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
    name: "hug",
    category: "fun",
    description: "Give someone a warm hug!",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.reply("Please mention someone to hug! ❤️");
        }

        if (user.id === message.author.id) {
            return message.reply("You can't hug yourself! 😔");
        }

        const randomGif = hugGifs[Math.floor(Math.random() * hugGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#ff66b2")
            .setTitle(`${message.author.username} hugs ${user.username}`)
            .setDescription(`${message.author.username} wraps their arms around ${user.username} with warmth and care! 💗`)
            .setImage(randomGif)
            .setFooter({ text: "Joker Music • Action Command" });

        message.channel.send({ embeds: [embed] });
    }
};
