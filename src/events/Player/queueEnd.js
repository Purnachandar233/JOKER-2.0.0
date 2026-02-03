const delay = require("delay");
const ms = require('ms');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const twentyfourseven = require("../../schema/twentyfourseven");
const safePlayer = require('../../utils/safePlayer');

module.exports = async (client, player) => {
    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel) return;

    if (player.get(`playingsongmsg`)) {
        player.get(`playingsongmsg`).delete().catch(() => {});
    }

    let queue_end = new EmbedBuilder()
        .setColor(client?.embedColor || '#ff0051')
        .setAuthor({ 
            name: `Queue More Songs/Enable Autoplay!`, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setDescription(`The queue has ended. You can [vote](https://top.gg/bot/${client.user.id}/vote) for the bot to support us!`);

    // Check autoplay (player metadata) and 24/7 setting (database)
    const isAutoplayEnabled = player.get && player.get('autoplay') === true;
    let is247Enabled = false;
    try {
        const doc = await twentyfourseven.findOne({ guildID: player.guildId });
        if (doc) is247Enabled = true;
    } catch (e) {
        client.logger?.log(`Failed to read 24/7 setting for guild ${player.guildId}: ${e.message}`, 'warn');
    }

    // Send queue ended embed
    channel.send({ embeds: [queue_end] }).catch(() => {});

    // If neither autoplay nor 24/7 are enabled, send a leave message, clear player metadata, then destroy the player (leave VC)
    if (!isAutoplayEnabled && !is247Enabled) {
        try {
            const leaveEmbed = new EmbedBuilder()
                .setColor(client?.embedColor || '#ff0051')
                .setDescription("Leaving voice channel — enable 24/7 to keep me here.");
            await channel.send({ embeds: [leaveEmbed] }).catch(() => {});
        } catch (e) {
            // ignore send errors
        }

        // small delay to allow messages to deliver
        await delay(1500);
        try {
            // clear commonly used in-memory player keys
            const keysToClear = ['autoplay', 'requester', 'identifier', 'playingsongmsg', 'suppressUntil'];
            for (const k of keysToClear) {
                try { if (player && typeof player.set === 'function') player.set(k, null); } catch (e) {}
            }

            if (player) {
                await safePlayer.safeDestroy(player);
            }
        } catch (e) {
            client.logger?.log(`Failed to destroy player for guild ${player.guildId}: ${e.message}`, 'error');
        }
    } else {
        // Not leaving VC due to autoplay/24/7
    }
};