module.exports = async (client, player, track, payload) => {
    try {
        const msg = player.get(`playingsongmsg`);
        if (msg) await msg.delete().catch(() => {});
    } catch (e) {}
    
    const autoplay = player.get("autoplay");
    if (autoplay === true) {
        try {
            // Prefer the ended track's identifier instead of relying on player.queue.current
            let identifier = track?.identifier || track?.info?.identifier || null;

            // Fallback: try to extract from URI if necessary
            if (!identifier && track && track.info && typeof track.info.uri === 'string') {
                const uri = track.info.uri;
                const vMatch = uri.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
                if (vMatch && vMatch[1]) identifier = vMatch[1];
                const shortMatch = uri.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
                if (!identifier && shortMatch && shortMatch[1]) identifier = shortMatch[1];
            }

            if (!identifier) return;

            // Resolve requester: prefer member object in player metadata; otherwise try to rehydrate from stored requesterId
            let requester = player.get("requester");
            if (!requester) {
                const requesterId = player.get('requesterId') || player.get('requester')?.id || null;
                if (requesterId) {
                    const guild = client.guilds.cache.get(player.guildId);
                    if (guild) requester = await guild.members.fetch(requesterId).catch(() => null);
                }
            }
            if (!requester) return;

            const search = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
            const res = await player.search(search, requester.user ? requester.user : requester);

            if (res && res.tracks && res.tracks.length > 0) {
                const trackToAdd = res.tracks[0];
                if (trackToAdd) {
                    const safePlayer = require('../../utils/safePlayer');
                    safePlayer.queueAdd(player, trackToAdd);
                }
            }
        } catch (error) {
            console.error('[ERROR] trackEnd autoplay:', error.message);
        }
    }
};