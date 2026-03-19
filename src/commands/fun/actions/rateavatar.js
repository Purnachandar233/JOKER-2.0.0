const { EmbedBuilder } = require("discord.js");
const { getActionGif } = require("../../../utils/actionGifProvider");

// Helper function to get first mentioned user from both Collection and Map
function getFirstMentionedUser(message, args, client) {
    if (message.mentions.users.first) {
        // It's a Collection (normal message)
        return message.mentions.users.first() || (args[0] ? client.users.cache.get(args[0]) : null) || message.author;
    } else if (message.mentions.users instanceof Map) {
        // It's a Map (from slash command)
        return message.mentions.users.values().next().value || (args[0] ? client.users.cache.get(args[0]) : null) || message.author;
    }
    return (args[0] ? client.users.cache.get(args[0]) : null) || message.author;
}

module.exports = {
    name: "rateavatar",
    aliases: ["avatarrate", "avgr", "arate"],
    category: "fun",
    description: "Rate someone's avatar!",
    usage: "rateavatar @user",
    execute: async (message, args, client, prefix) => {
        const user = await getFirstMentionedUser(message, args, client);

        if (!user) {
            return message.channel.send("Please mention a valid user or provide their ID!");
        }

        const rating = Math.floor(Math.random() * 41) + 60; // Rating between 60-100 for positivity
        const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 512 });

        let feedback = "";
        if (rating >= 90) {
            feedback = "Absolutely stunning! That's a masterpiece! 🤩";
        } else if (rating >= 80) {
            feedback = "Looking great! Very professional and attractive! 😍";
        } else if (rating >= 70) {
            feedback = "Nice avatar! Pretty cool choice! 😊";
        } else {
            feedback = "Not bad at all! Shows good taste! 👍";
        }

        const reactionGif = await getActionGif("happy");

        const embed = new EmbedBuilder()
            .setColor("#ffb6c1")
            .setTitle(`Avatar Rating for ${user.username}`)
            .setDescription(`${feedback}`)
            .addFields(
                { name: "Overall Rating", value: `**${rating}/100** ${"⭐".repeat(Math.floor(rating / 20))}`, inline: false }
            )
            .setThumbnail(avatarUrl)
            .setImage(reactionGif);

        message.channel.send({ embeds: [embed] });
    }
};
