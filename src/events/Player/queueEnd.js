const delay = require("delay");
const ms = require('ms');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");

module.exports = async (client, player) => {
    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel) return;

    if (player.get(`playingsongmsg`)) {
        player.get(`playingsongmsg`).delete().catch(() => {});
    }

    let queue_end = new EmbedBuilder()
        .setColor(0xff0051)
        .setAuthor({ 
            name: `Queue More Songs/Enable Autoplay!`, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setDescription(`The queue has ended. You can [vote](https://top.gg/bot/898941398538158080/vote) for the bot to support us!`);

    channel.send({ embeds: [queue_end] }).catch(() => {});
};