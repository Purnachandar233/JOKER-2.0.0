const { EmbedBuilder } = require("discord.js");
const { getActionGif } = require("../../../utils/actionGifProvider");

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
    name: "slap",
    category: "fun",
    description: "Give someone a playful slap!",
    execute: async (message, args, client, prefix) => {
        const user = getFirstMentionedUser(message, args, client);

        if (!user) {
            return message.reply("Please mention someone to slap! 😅");
        }

        if (user.id === message.author.id) {
            return message.reply("You can't slap yourself! 🙈");
        }

        const randomGif = await getActionGif("slap");

        const embed = new EmbedBuilder()
            .setColor("#ff6b6b")
            .setTitle(`${message.author.username} slaps ${user.username}`)
            .setDescription(`${user.username} just received a playful slap from ${message.author.username}! 🤚`)
            .setImage(randomGif)
message.channel.send({ embeds: [embed] });
    }
};
