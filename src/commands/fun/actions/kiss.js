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

        const randomGif = await getActionGif("kiss");

        const embed = new EmbedBuilder()
            .setColor("#ff1493")
            .setTitle(`${message.author.username} kisses ${user.username}`)
            .setDescription(`${message.author.username} gives ${user.username} a sweet kiss! 💋`)
            .setImage(randomGif);

        message.channel.send({ embeds: [embed] });
    }
};
