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
    name: "hug",
    aliases: ["embrace", "hugs"],
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

        const randomGif = await getActionGif("hug");

        const embed = new EmbedBuilder()
            .setColor("#ff66b2")
            .setTitle(`${message.author.username} hugs ${user.username}`)
            .setDescription(`${message.author.username} wraps their arms around ${user.username} with warmth and care! 💗`)
            .setImage(randomGif);

        message.channel.send({ embeds: [embed] });
    }
};
