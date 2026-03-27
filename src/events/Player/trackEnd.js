const User = require("../../schema/User");
const { withTimeout } = require("../../utils/promiseHandler");
const AUTOPLAY_SOURCE_ORDER = ["spotify", "soundcloud", "deezer"];
const AUTOPLAY_SEARCH_TIMEOUT_MS = 4500;
const AUTOPLAY_RETRY_GUARD_MS = 15000;

function normalizeSourceName(source) {
    const value = String(source || "").trim().toLowerCase();
    return value || null;
}

function buildAutoplaySourceOrder(player) {
    const preferred = normalizeSourceName(
        typeof player?.get === "function" ? player.get("preferredSearchSource") : null
    );
    const ordered = [...new Set(AUTOPLAY_SOURCE_ORDER.map(normalizeSourceName).filter(Boolean))];

    if (!preferred || !ordered.includes(preferred)) {
        return ordered;
    }

    return [preferred, ...ordered.filter((source) => source !== preferred)];
}

function resolveAutoplayRequester(client, player) {
    const storedRequester = typeof player?.get === "function" ? player.get("requester") : null;
    if (storedRequester?.user) return storedRequester.user;
    if (storedRequester && typeof storedRequester === "object") return storedRequester;

    const requesterId = String(
        (typeof player?.get === "function" ? player.get("requesterId") : null) || ""
    ).trim();
    if (requesterId) {
        return client?.users?.cache?.get(requesterId) || client?.user || null;
    }

    return client?.user || null;
}

function shouldCountTrackEnd(payload) {
    const reason = String(payload?.reason || payload?.type || "")
        .trim()
        .toLowerCase();

    if (!reason) return true;
    return reason === "finished";
}

function trackListenStats(client, player, track, payload) {
    if (!shouldCountTrackEnd(payload)) return;

    const queueTools = client?.core?.queue || {};
    const getRequesterInfo = typeof queueTools.getRequesterInfo === "function"
        ? queueTools.getRequesterInfo
        : (() => ({ id: null }));
    const getTrackDurationMs = typeof queueTools.getTrackDurationMs === "function"
        ? queueTools.getTrackDurationMs
        : (() => 0);

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
    trackListenStats(client, player, track, payload);

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

            const now = Date.now();
            const lastAutoplayQuery = typeof player?.get === "function" ? player.get("lastAutoplayQuery") : null;
            const lastAutoplayAttemptAt = Number(
                typeof player?.get === "function" ? player.get("lastAutoplayAttemptAt") : 0
            );
            if (
                lastAutoplayQuery === builtQuery &&
                Number.isFinite(lastAutoplayAttemptAt) &&
                lastAutoplayAttemptAt > 0 &&
                (now - lastAutoplayAttemptAt) < AUTOPLAY_RETRY_GUARD_MS
            ) {
                return;
            }

            if (typeof player?.set === "function") {
                player.set("lastAutoplayQuery", builtQuery);
                player.set("lastAutoplayAttemptAt", now);
            }

            const requester = resolveAutoplayRequester(client, player);
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
                const sources = buildAutoplaySourceOrder(player);
                for (const source of sources) {
                    try {
                        const sp = player.search({ query: builtQuery, source }, requester.user ? requester.user : requester);
                        const r = await withTimeout(sp, AUTOPLAY_SEARCH_TIMEOUT_MS, 'search timeout').catch(() => null);
                        if (r && r.tracks && r.tracks.length > 0) {
                            res = r;
                            if (typeof player?.set === "function") {
                                player.set("preferredSearchSource", source);
                            }
                            break;
                        }
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
