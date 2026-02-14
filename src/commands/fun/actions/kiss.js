const { EmbedBuilder } = require("discord.js");

// Valid anime kiss GIF URLs from Tenor
const kissGifs = [
    "https://media1.tenor.com/m/KE3VW3qP4RAAAAAC/kiss.gif",
    "https://media1.tenor.com/m/LHZoG2CfdGoAAAAd/yosuga-no-sora.gif",
    "https://media1.tenor.com/m/698PTTlZ0Q8AAAAd/bebou.gif",
    "https://media1.tenor.com/m/KE3VW3qP4RAAAAAd/kiss.gif"
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
    name: "kiss",
    category: "fun",
    description: "Give someone a sweet kiss!",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.reply("Please mention someone to kiss! 😘");
        }

        if (user.id === message.author.id) {
            return message.reply("You can't kiss yourself! 😳");
        }

        const randomGif = kissGifs[Math.floor(Math.random() * kissGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#ff1493")
            .setTitle(`${message.author.username} kisses ${user.username}`)
            .setDescription(`${message.author.username} gives ${user.username} a sweet kiss! 💋`)
            .setImage(randomGif)
            .setFooter({ text: "Joker Music • Action Command" });

        message.channel.send({ embeds: [embed] });
    }
};
