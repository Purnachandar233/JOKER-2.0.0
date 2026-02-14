const { EmbedBuilder } = require("discord.js");

// Valid anime love/ship GIF URLs from Tenor
const shipGifs = [
    "https://media.tenor.com/8Hx0K5W9PnMAAAAC/ship-anime.gif",
    "https://media.tenor.com/2LkM6N0Q6RwAAAAC/ship.gif",
    "https://media.tenor.com/Z2pR9Y5T7KjAAAAC/anime-love.gif",
    "https://media.tenor.com/D7sZ1K9L1QwAAAAC/ship-naruto.gif",
    "https://media.tenor.com/G3tY0M7N4VpAAAAC/love-anime.gif"
];

module.exports = {
    name: "ship",
    category: "fun",
    description: "Ship two users together!",
    execute: async (message, args, client, prefix) => {
        const mentions = message.mentions.users;
        
        if (mentions.size < 2) {
            return message.reply("Please mention two people to ship! 💕");
        }

        const users = Array.from(mentions.values());
        const user1 = users[0];
        const user2 = users[1];

        if (user1.id === user2.id) {
            return message.reply("You can't ship someone with themselves! 😅");
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
            .setImage(randomGif)
            .setFooter({ text: "Joker Music • Ship Command" });

        message.channel.send({ embeds: [embed] });
    }
};
