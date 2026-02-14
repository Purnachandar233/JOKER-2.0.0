const { EmbedBuilder } = require("discord.js");

// Valid anime punch GIF URLs from Tenor
const punchGifs = [
    "https://media.tenor.com/3Rk6W1F6xNsAAAAC/punch-anime.gif",
    "https://media.tenor.com/8XqG2K5Y7ZoAAAAC/punch.gif",
    "https://media.tenor.com/M6vP9L4kKjIAAAAC/anime-punch.gif",
    "https://media.tenor.com/Q1nR8Y7tL0pAAAAC/punch-rock-lee.gif",
    "https://media.tenor.com/T5wE9X2mN8rAAAAC/punch-naruto.gif"
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
    name: "punch",
    category: "fun",
    description: "Punch someone playfully!",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.reply("Please mention someone to punch! 👊");
        }

        if (user.id === message.author.id) {
            return message.reply("You can't punch yourself! 😅");
        }

        const randomGif = punchGifs[Math.floor(Math.random() * punchGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#ff4500")
            .setTitle(`${message.author.username} punches ${user.username}`)
            .setDescription(`${message.author.username} throws a powerful punch at ${user.username}! POW! 👊`)
            .setImage(randomGif)
            .setFooter({ text: "Joker Music • Action Command" });

        message.channel.send({ embeds: [embed] });
    }
};
