const { EmbedBuilder } = require("discord.js");
const safePlayer = require('../../utils/safePlayer');

module.exports = async (client, player, track, payload) => {
    try {
        await safePlayer.safeStop(player);

        const channel = client.channels.cache.get(player.textChannelId);
        if (!channel) return;

        const trackTitle = track?.title || track?.info?.title || 'Unknown';
        const failed = new EmbedBuilder()
            .setColor(client?.embedColor || '#ff0051')
            .setDescription(`Something is wrong with ${trackTitle}\nPlease report this to developers so they can fix the issue.`);

        await channel.send({ embeds: [failed] }).catch(() => {});

        try {
            const msg = player.get(`playingsongmsg`);
            if (msg) await msg.delete().catch(() => {});
        } catch (e) {}
    } catch (error) {
        console.error('[ERROR] trackStuck:', error.message);
    }
};
