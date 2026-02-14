const { EmbedBuilder } = require("discord.js");

// Valid anime punch GIF URLs - Updated working sources
const punchGifs = [
    "https://media1.giphy.com/media/l0CYfENvjZpIeO6IM/giphy.gif",
    "https://media2.giphy.com/media/l3q2K5jinAlZ19ySm/giphy.gif",
    "https://media3.giphy.com/media/l0HlE7Q0oPSfyxjDO/giphy.gif",
    "https://media4.giphy.com/media/l0HlDtKPoZ2QW0lh6/giphy.gif",
    "https://media2.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif"
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
    aliases: ["hit", "slap"],
    category: "fun",
    description: "Punch someone playfully!",
    usage: "punch @user",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.channel.send("Please mention someone to punch! 👊");
        }

        if (user.id === message.author.id) {
            return message.channel.send("You can't punch yourself! 😅");
        }

        const randomGif = punchGifs[Math.floor(Math.random() * punchGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#ff4500")
            .setTitle(`${message.author.username} punches ${user.username}`)
            .setDescription(`${message.author.username} throws a powerful punch at ${user.username}! POW! 👊`)
            .setImage(randomGif);

        message.channel.send({ embeds: [embed] });
    }
};
