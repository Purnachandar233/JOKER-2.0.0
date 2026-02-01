const { EmbedBuilder } = require("discord.js");
const safePlayer = require('../../utils/safePlayer');

module.exports = async (client, player, track, payload) => {
    try {
        // Advance playback to avoid getting stuck on erroring track
        await safePlayer.safeStop(player);
        const channel = client.channels.cache.get(player.textChannelId);
        if (!channel) return;

        const trackTitle = track?.title || track?.info?.title || 'Unknown';
        const thing = new EmbedBuilder()
            .setColor(client?.embedColor || '#ff0051')
            .setDescription(`An error occurred while playing [${trackTitle}](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\nThis song may be banned or private in your country.`);
        
        await channel.send({ embeds: [thing] }).catch(() => {});

        if (!player.voiceChannelId) {
            await safePlayer.safeDestroy(player);
        }
    } catch (error) {
        console.error('[ERROR] trackError:', error.message);
    }
};
