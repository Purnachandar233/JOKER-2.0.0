const { EmbedBuilder } = require("discord.js");

// Valid anime love/ship GIF URLs - Updated working sources
const shipGifs = [
    "https://media1.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
    "https://media2.giphy.com/media/l0MYt5j31ESjHf7bG/giphy.gif",
    "https://media3.giphy.com/media/l0Iy1FZAt0oVHcsQw/giphy.gif",
    "https://media4.giphy.com/media/l0IykYQh0u1QNxTHy/giphy.gif",
    "https://media1.giphy.com/media/iKBAAfYNgnXSozLVyn/giphy.gif"
];

module.exports = {
    name: "ship",
    aliases: ["love", "relationship"],
    category: "fun",
    description: "Ship two users together!",
    usage: "ship @user1 @user2",
    execute: async (message, args, client, prefix) => {
        const mentions = message.mentions.users;
        
        if (mentions.size < 2) {
            return message.channel.send("Please mention two people to ship! 💕");
        }

        const users = Array.from(mentions.values());
        const user1 = users[0];
        const user2 = users[1];

        if (user1.id === user2.id) {
            return message.channel.send("You can't ship someone with themselves! 😅");
        }

        const percentage = Math.floor(Math.random() * 100) + 1;
        let rating = "";
        
        if (percentage >= 80) {
            rating = "A match made in heaven! 💕💕💕";
        } else if (percentage >= 60) {
            rating = "A pretty good match! 💕💕";
        } else if (percentage >= 40) {
            rating = "Could work with some effort! 💕";
        } else if (percentage >= 20) {
            rating = "Needs some work... 😅";
        } else {
            rating = "Probably not meant to be... 😔";
        }

        const shipName = `${user1.username.slice(0, Math.ceil(user1.username.length / 2))}${user2.username.slice(Math.floor(user2.username.length / 2))}`;

        const randomGif = shipGifs[Math.floor(Math.random() * shipGifs.length)];

        const embed = new EmbedBuilder()
            .setColor("#ff1493")
            .setTitle(`⚡ ${user1.username} + ${user2.username} ⚡`)
            .setDescription(`Ship Name: **${shipName}**`)
            .addFields(
                { name: "Compatibility", value: `${percentage}%`, inline: true },
                { name: "Rating", value: rating, inline: true }
            )
            .setThumbnail(user1.displayAvatarURL({ dynamic: true }))
            .setImage(randomGif);

        message.channel.send({ embeds: [embed] });
    }
};
