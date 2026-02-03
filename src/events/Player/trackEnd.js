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

            // Prefer an explicit autoplay query saved earlier; otherwise build
            // a query string from the ended track's metadata. We purposely do
            // NOT perform YouTube-based searches to avoid using YouTube.
            const autoplayQuery = player.get('autoplayQuery') || null;
            const builtQuery = autoplayQuery || ((track?.info?.title || track?.title) ? `${track?.info?.title || track?.title} ${track?.info?.author || ''}`.trim() : null);
            if (!builtQuery) return;

            // Resolve requester: support stored member object or stored requesterId (string).
            let requester = player.get("requester");
            // If requester is an ID (string), try to fetch member
            if (typeof requester === 'string') {
                const guild = client.guilds.cache.get(player.guildId);
                if (guild) requester = await guild.members.fetch(requester).catch(() => null);
            }
            // If not present, try requesterId metadata
            if (!requester) {
                const requesterId = player.get('requesterId') || null;
                if (requesterId) {
                    const guild = client.guilds.cache.get(player.guildId);
                    if (guild) requester = await guild.members.fetch(requesterId).catch(() => null);
                }
            }
            if (!requester) return;

            let res = null;
            try {
                // Search non-YouTube sources using the built query.
                const sources = ['soundcloud', 'spotify', 'bandcamp', 'deezer', 'applemusic'];
                for (const source of sources) {
                    try {
                        const sp = player.search({ query: builtQuery, source }, requester.user ? requester.user : requester);
                        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('search timeout')), 8000));
                        const r = await Promise.race([sp, timeout]).catch(() => null);
                        if (r && r.tracks && r.tracks.length > 0) { res = r; break; }
                    } catch (_) { continue; }
                }

                if (res && res.tracks && res.tracks.length > 0) {
                    const trackToAdd = res.tracks[0];
                    if (trackToAdd) {
                        const safePlayer = require('../../utils/safePlayer');
                        safePlayer.queueAdd(player, trackToAdd);
                    }
                }
            } catch (e) {
                // swallow - handled by outer try
            }
        } catch (error) {
            console.error('[ERROR] trackEnd autoplay:', error.message);
        }
    }
};