const { EmbedBuilder } = require("discord.js");

// Verified working anime romantic hug GIFs
const hugGifs = [
    "https://media.giphy.com/media/v2LYL3dw3i3OwH94L5/giphy.gif",  // Romantic anime hug
    "https://media.giphy.com/media/l0HlN9Q0kYWd74nAQ/giphy.gif",  // Emotional embrace
    "https://media.giphy.com/media/3o7TKU8gNS9TQfm8OI/giphy.gif",  // Sweet hug
    "https://media.giphy.com/media/iKBAAfYNgnXSozLVyn/giphy.gif", // Intimate moment
    "https://media.giphy.com/media/L95W4z3PSpLT60Opie/giphy.gif"  // Close embrace
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
    aliases: ["embrace", "cuddle", "hugs"],
    category: "fun",
    description: "Give someone a warm hug!",
    usage: "hug @user",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.channel.send("Please mention someone to hug! ❤️");
        }

        if (user.id === message.author.id) {
            return message.channel.send("You can't hug yourself! 😔");
        }

        const randomGif = hugGifs[Math.floor(Math.random() * hugGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#ff66b2")
            .setTitle(`${message.author.username} hugs ${user.username}`)
            .setDescription(`${message.author.username} wraps their arms around ${user.username} with warmth and care! 💗`)
            .setImage(randomGif);

        message.channel.send({ embeds: [embed] });
    }
};
