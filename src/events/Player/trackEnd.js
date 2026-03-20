const User = require("../../schema/User");
const { getRequesterInfo, getTrackDurationMs } = require("../../utils/queue");

function shouldCountTrackEnd(payload) {
    const reason = String(payload?.reason || payload?.type || "")
        .trim()
        .toLowerCase();

    if (!reason) return true;
    return reason === "finished";
}

function trackListenStats(player, track, payload) {
    if (!shouldCountTrackEnd(payload)) return;

    const fallbackRequester = typeof player?.get === "function" ? player.get("requester") : null;
    const fallbackRequesterId = typeof player?.get === "function" ? player.get("requesterId") : null;
    const requester = getRequesterInfo(track, {
        fallbackRequester,
        fallbackRequesterId,
        fallbackTag: null,
    });

    const requesterId = requester?.id ? String(requester.id) : null;
    if (!requesterId) return;

    const durationMs = Number(getTrackDurationMs(track) || 0);

    User.findOneAndUpdate(
        { userId: requesterId },
        {
            $inc: {
                songsListened: 1,
                totalListenTimeMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0,
            },
            $setOnInsert: { userId: requesterId },
        },
        { upsert: true, setDefaultsOnInsert: true }
    ).catch(() => {});
}

module.exports = async (client, player, track, payload) => {
    try {
        const msg = player.get(`playingsongmsg`);
        if (msg) await msg.delete().catch(() => {});
    } catch (e) {}

    trackListenStats(player, track, payload);

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
            if (!client?.lavalink) return;
            if (!client.lavalink.useable && typeof client.waitForLavalinkReady === 'function') {
                const ready = await client.waitForLavalinkReady(1500).catch(() => false);
                if (!ready) return;
            } else if (!client.lavalink.useable) {
                return;
            }

            let res = null;
            try {
                // Search non-YouTube sources using the built query.
                const sources = ['spotify', 'soundcloud', 'bandcamp', 'deezer', 'applemusic'];
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
                        if (typeof player.queue?.add === "function") {
                            await player.queue.add(trackToAdd);
                        } else if (Array.isArray(player.queue?.tracks)) {
                            player.queue.tracks.push(trackToAdd);
                        }
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
