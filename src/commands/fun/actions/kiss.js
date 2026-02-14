const { EmbedBuilder } = require("discord.js");

// Verified working anime romantic kiss GIFs
const kissGifs = [
    "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",  // Romantic anime kiss
    "https://media.giphy.com/media/v2LYL3dw3i3OwH94L5/giphy.gif", // Sweet kiss moment
    "https://media.giphy.com/media/3o7TKU8gNS9TQfm8OI/giphy.gif",  // Passionate kiss
    "https://media.giphy.com/media/iKBAAfYNgnXSozLVyn/giphy.gif"   // Tender kiss scene
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
    aliases: ["smooch", "kisses","ummah"],  
    category: "fun",
    description: "Give someone a sweet kiss!",
    usage: "kiss @user",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);
        
        if (!user) {
            return message.channel.send("Please mention someone to kiss! 😘");
        }

        if (user.id === message.author.id) {
            return message.channel.send("You can't kiss yourself! 😳");
        }

        const randomGif = kissGifs[Math.floor(Math.random() * kissGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#ff1493")
            .setTitle(`${message.author.username} kisses ${user.username}`)
            .setDescription(`${message.author.username} gives ${user.username} a sweet kiss! 💋`)
            .setImage(randomGif);
            
        message.channel.send({ embeds: [embed] });
    }
};
