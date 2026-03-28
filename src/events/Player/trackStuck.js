const { EmbedBuilder } = require("discord.js");

async function resolveTextChannel(client, channelId) {
    if (!channelId) return null;

    const cached = client.channels.cache.get(channelId);
    if (cached) return cached;

    if (typeof client.channels?.fetch === "function") {
        return client.channels.fetch(channelId).catch(() => null);
    }

    return null;
}

module.exports = async (client, player, track, payload) => {
    try {
        if (Array.isArray(player?.queue?.tracks) && player.queue.tracks.length > 0) {
            await player.skip();
        } else {
            if (typeof player?.set === "function") {
                player.set("suppressQueueEndNoticeUntil", Date.now() + 6000);
            }
            await player.stopPlaying(false, false).catch(() => {});
        }

        const channel = await resolveTextChannel(client, player.textChannelId);
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
        client.logger?.log?.(`[ERROR] trackStuck: ${error.message}`, "error");
    }
};
