const { EmbedBuilder } = require("discord.js");

module.exports = async (client, player, track, payload) => {
    try {
        player.stop();
        const channel = client.channels.cache.get(player.textChannelId);
        if (!channel) return;

        const trackTitle = track?.title || track?.info?.title || 'Unknown';
        const thing = new EmbedBuilder()
            .setColor("RED")
            .setDescription(`An error occurred while playing [${trackTitle}](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\nThis song may be banned or private in your country.`);
        
        await channel.send({ embeds: [thing] }).catch(() => {});

        if (!player.voiceChannelId) {
            player.destroy();
        }
    } catch (error) {
        console.error('[ERROR] trackError:', error.message);
    }
};
