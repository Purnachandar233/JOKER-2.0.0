const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, Collection } = require("discord.js");
module.exports = async (client, player, oldChannel, newChannel) => {
    try {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild) return;
        const channel = guild.channels.cache.get(player.textChannelId);
        
        if (oldChannel === newChannel) return;
        
        if (newChannel === null || !newChannel) {
            if (!player) return;
            if (channel) {
                const msg = player.get(`playingsongmsg`);
                if (msg && msg.delete) {
                    await msg.delete().catch(() => {});
                }
                const safePlayer = require('../../utils/safePlayer');
                await safePlayer.safeDestroy(player);
            }
        } else {
            // Don't try to set read-only property, just resume playback
            setTimeout(() => {
                const safePlayer = require('../../utils/safePlayer');
                safePlayer.safeCall(player, 'pause', false);
            }, 100);
        }

        if (!channel) return;

        const oldChannelName = oldChannel ? `<#${oldChannel.id}>` : 'Unknown';
        const newChannelName = newChannel ? `<#${newChannel.id}>` : 'Unknown';
        
        const denginde = new EmbedBuilder()
            .setColor(client?.embedColor || '#ff0051')
            .setTitle(`Player has been moved`)
            .setDescription(`I have been moved from ${oldChannelName} to ${newChannelName}`);
        
        const msg = await channel.send({ embeds: [denginde] }).catch(() => {});
        if (msg) {
            setTimeout(() => {
                if (msg.delete) msg.delete().catch(() => {});
            }, 10000);
        }
    } catch (error) {
        console.error('[ERROR] playerMove:', error.message);
    }
};
