const { EmbedBuilder } = require("discord.js");
const { withTimeout } = require("../../utils/promiseHandler");

const FALLBACK_SOURCE_ORDER = ["soundcloud", "applemusic", "deezer", "bandcamp", "spotify"];
const FALLBACK_TIMEOUT_MS = 4500;
const MAX_FALLBACK_HISTORY = 30;
const FALLBACK_SCAN_LIMIT = 6;
const MAX_FALLBACK_SOURCE_ATTEMPTS = 2;
const FALLBACK_ATTEMPT_COOLDOWN_MS = 12000;
const MIN_FALLBACK_SCORE = 0.46;

const REGION_OR_PRIVATE_PATTERN = /country|region|geo|private|forbidden|403|blocked|copyright|not available|unavailable|removed|restricted/i;
const TIMEOUT_OR_NETWORK_PATTERN = /timeout|timed out|socket|connect|connection|econnreset|network|host|dns|gateway/i;
const SOURCE_FAILURE_PATTERN = /server responded with an error|source failed|load failed|no mirror found|status code|http\s*\d{3}|429|500|501|502|503|504|bad gateway|service unavailable|internal server error|unauthorized|forbidden/i;
const TITLE_STOPWORDS = new Set([
    "official",
    "video",
    "audio",
    "lyric",
    "lyrics",
    "topic",
    "from",
    "with",
    "feat",
    "featuring",
    "ft",
    "music",
    "song",
    "remix",
    "version",
    "hq",
    "hd",
    "full",
    "cover",
    "karaoke",
    "live",
    "edit",
]);

function getTrackTitle(track) {
    return track?.title || track?.info?.title || "Unknown";
}

function getTrackSource(track) {
    return String(track?.info?.sourceName || track?.sourceName || "").trim().toLowerCase();
}

function getTrackIdentifier(track) {
    return String(
        track?.info?.identifier ||
        track?.identifier ||
        track?.id ||
        track?.info?.uri ||
        track?.uri ||
        ""
    ).trim().toLowerCase();
}

function getTrackAuthor(track) {
    return track?.info?.author || track?.author || "";
}

function getTrackDurationMs(track) {
    const duration = Number(track?.info?.duration ?? track?.duration ?? track?.info?.length ?? 0);
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function normalizeText(value, maxLength = 220) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
}

function normalizeForCompare(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenize(value) {
    return normalizeForCompare(value)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token && token.length > 1 && !TITLE_STOPWORDS.has(token));
}

function countTokenOverlap(leftTokens, rightTokens) {
    if (!leftTokens.length || !rightTokens.length) return 0;
    const rightSet = new Set(rightTokens);
    let overlap = 0;
    for (const token of leftTokens) {
        if (rightSet.has(token)) overlap += 1;
    }
    return overlap;
}

function extractErrorMessage(payload) {
    const candidates = [
        payload?.exception?.message,
        payload?.exception?.cause,
        payload?.error,
        payload?.message,
        payload?.reason,
        payload?.cause,
        payload?.stack,
    ];

    if (payload instanceof Error) {
        candidates.unshift(payload.message);
    }

    for (const candidate of candidates) {
        const text = normalizeText(candidate);
        if (text) return text;
    }

    return "";
}

function getErrorHint(errorMessage) {
    if (!errorMessage) {
        return "The source failed to serve this track.";
    }

    if (REGION_OR_PRIVATE_PATTERN.test(errorMessage)) {
        return "This track appears to be private or unavailable in this region on the current source.";
    }

    if (/no mirror found/i.test(errorMessage)) {
        return "No matching mirror was found for this track on the current source.";
    }

    if (TIMEOUT_OR_NETWORK_PATTERN.test(errorMessage)) {
        return "The source timed out or had a temporary network issue while streaming this track.";
    }

    if (SOURCE_FAILURE_PATTERN.test(errorMessage)) {
        return "The source returned a server-side error while trying to stream this track.";
    }

    return "The source failed to serve this track.";
}

function shouldAttemptSourceFallback(_track, errorMessage) {
    if (!errorMessage) return true;

    return (
        REGION_OR_PRIVATE_PATTERN.test(errorMessage) ||
        SOURCE_FAILURE_PATTERN.test(errorMessage) ||
        TIMEOUT_OR_NETWORK_PATTERN.test(errorMessage)
    );
}

function formatSourceName(source) {
    const value = String(source || "").trim();
    if (!value) return "another source";
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeSourceName(source) {
    const value = String(source || "").trim().toLowerCase();
    return value || null;
}

function buildFallbackKey(track) {
    const title = normalizeText(getTrackTitle(track), 160).toLowerCase();
    const author = normalizeText(getTrackAuthor(track), 120).toLowerCase();
    if (!title) return null;
    return `${title}|${author}`;
}

function canAttemptFallback(player, track) {
    if (!player || typeof player.get !== "function" || typeof player.set !== "function") return true;

    const key = buildFallbackKey(track);
    if (!key) return false;

    const now = Date.now();
    const lastAttemptAt = Number(player.get("trackErrorFallbackAttemptAt") || 0);
    if (Number.isFinite(lastAttemptAt) && lastAttemptAt > 0 && (now - lastAttemptAt) < FALLBACK_ATTEMPT_COOLDOWN_MS) {
        return false;
    }

    const history = Array.isArray(player.get("trackErrorFallbackHistory"))
        ? player.get("trackErrorFallbackHistory")
        : [];

    if (history.includes(key)) return false;

    history.push(key);
    if (history.length > MAX_FALLBACK_HISTORY) {
        history.splice(0, history.length - MAX_FALLBACK_HISTORY);
    }

    player.set("trackErrorFallbackAttemptAt", now);
    player.set("trackErrorFallbackHistory", history);
    return true;
}

function getRequester(player, track) {
    const requester =
        track?.requester ||
        track?.userData?.requester ||
        (typeof player?.get === "function" ? player.get("requester") : null) ||
        null;

    if (!requester) return null;
    return requester?.user || requester;
}

function scoreFallbackCandidate(targetTrack, candidateTrack) {
    const targetTitle = getTrackTitle(targetTrack);
    const targetAuthor = getTrackAuthor(targetTrack);
    const candidateTitle = getTrackTitle(candidateTrack);
    const candidateAuthor = getTrackAuthor(candidateTrack);

    const targetTitleTokens = tokenize(targetTitle);
    const candidateTitleTokens = tokenize(candidateTitle);
    if (!targetTitleTokens.length || !candidateTitleTokens.length) {
        return { accepted: false, score: 0 };
    }

    const titleOverlap = countTokenOverlap(targetTitleTokens, candidateTitleTokens);
    if (titleOverlap <= 0) return { accepted: false, score: 0 };

    const titleRatio = titleOverlap / targetTitleTokens.length;
    if (targetTitleTokens.length >= 3 && titleOverlap < 2 && titleRatio < 0.5) {
        return { accepted: false, score: titleRatio * 0.5 };
    }

    const targetAuthorTokens = tokenize(targetAuthor);
    const candidateAuthorTokens = tokenize(candidateAuthor);
    const authorOverlap = countTokenOverlap(targetAuthorTokens, candidateAuthorTokens);
    const authorRatio = targetAuthorTokens.length ? authorOverlap / targetAuthorTokens.length : 0;

    const targetDuration = getTrackDurationMs(targetTrack);
    const candidateDuration = getTrackDurationMs(candidateTrack);
    let durationScore = 0.4;
    if (targetDuration > 0 && candidateDuration > 0) {
        const diffRatio = Math.abs(candidateDuration - targetDuration) / targetDuration;
        if (diffRatio > 0.55) return { accepted: false, score: 0 };
        if (diffRatio <= 0.08) durationScore = 1;
        else if (diffRatio <= 0.18) durationScore = 0.85;
        else if (diffRatio <= 0.3) durationScore = 0.6;
        else durationScore = 0.35;
    }

    const targetComparable = normalizeForCompare(targetTitle);
    const candidateComparable = normalizeForCompare(candidateTitle);
    const containsBonus =
        targetComparable.length > 8 &&
        candidateComparable.length > 8 &&
        (candidateComparable.includes(targetComparable) || targetComparable.includes(candidateComparable))
            ? 0.12
            : 0;

    const score = (titleRatio * 0.72) + (authorRatio * 0.2) + (durationScore * 0.08) + containsBonus;
    return {
        accepted: score >= MIN_FALLBACK_SCORE,
        score,
    };
}

async function searchFallbackTrack(player, track, requester, client) {
    const title = getTrackTitle(track);
    const author = normalizeText(getTrackAuthor(track), 120);
    const query = normalizeText(`${title} ${author}`, 240);
    if (!query) return null;

    const failedSource = getTrackSource(track);
    const failedIdentifier = getTrackIdentifier(track);
    const preferredSource = normalizeSourceName(
        typeof player?.get === "function" ? player.get("preferredSearchSource") : null
    );
    const candidateSources = preferredSource
        ? [preferredSource, ...FALLBACK_SOURCE_ORDER]
        : [...FALLBACK_SOURCE_ORDER];
    const uniqueSources = [...new Set(candidateSources.map(normalizeSourceName).filter(Boolean))];
    const sources = (failedSource
        ? uniqueSources.filter((source) => source !== failedSource)
        : uniqueSources
    ).slice(0, MAX_FALLBACK_SOURCE_ATTEMPTS);

    let bestMatch = null;

    for (const source of sources) {
        try {
            const result = await withTimeout(
                player.search({ query, source }, requester),
                FALLBACK_TIMEOUT_MS,
                `${source} search timeout`
            );

            if (result?.loadType === "LOAD_FAILED" || !Array.isArray(result?.tracks) || !result.tracks.length) {
                continue;
            }

            const candidates = result.tracks
                .filter((item) => {
                    const candidateId = getTrackIdentifier(item);
                    const candidateSource = getTrackSource(item);
                    if (failedIdentifier && candidateId && candidateId === failedIdentifier) return false;
                    if (failedSource && candidateSource && candidateSource === failedSource) return false;
                    return true;
                })
                .slice(0, FALLBACK_SCAN_LIMIT);

            for (const item of candidates) {
                const { accepted, score } = scoreFallbackCandidate(track, item);
                if (!accepted) continue;

                if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { track: item, source, score };
                }
            }
        } catch (error) {
            const message = String(error?.message || error || "");
            if (!/has not '.*' enabled|has not .* enabled|required to have|Query \/ Link Provided for this Source/i.test(message)) {
                client.logger?.log?.(`trackError fallback search failed for ${source}: ${message}`, "warn");
            }
        }
    }

    if (bestMatch) {
        client.logger?.log?.(
            `trackError fallback picked ${getTrackTitle(bestMatch.track)} from ${bestMatch.source} (score=${bestMatch.score.toFixed(2)})`,
            "info"
        );
        if (typeof player?.set === "function") {
            player.set("preferredSearchSource", bestMatch.source);
        }
        return { track: bestMatch.track, source: bestMatch.source };
    }

    return null;
}

module.exports = async (client, player, track, payload) => {
    try {
        const channel = client.channels.cache.get(player.textChannelId);
        const trackTitle = getTrackTitle(track);
        const errorMessage = extractErrorMessage(payload);

        const hasQueuedTracks = Array.isArray(player?.queue?.tracks) && player.queue.tracks.length > 0;
        const canTrySourceFallback =
            !hasQueuedTracks &&
            shouldAttemptSourceFallback(track, errorMessage) &&
            canAttemptFallback(player, track);

        let recoveredWithFallback = false;
        let fallbackTrack = null;
        let fallbackSource = null;

        if (canTrySourceFallback) {
            const requester = getRequester(player, track);
            const fallback = await searchFallbackTrack(player, track, requester, client);

            if (fallback?.track) {
                try {
                    if (typeof player.queue?.add === "function") {
                        await player.queue.add(fallback.track);
                    } else if (Array.isArray(player?.queue?.tracks)) {
                        player.queue.tracks.push(fallback.track);
                    } else {
                        throw new Error("Queue is not available for fallback playback");
                    }

                    await player.skip();
                    recoveredWithFallback = true;
                    fallbackTrack = fallback.track;
                    fallbackSource = fallback.source;
                } catch (fallbackStartError) {
                    client.logger?.log?.(
                        `Failed to start fallback track in guild ${player.guildId}: ${fallbackStartError?.message || fallbackStartError}`,
                        "warn"
                    );
                }
            }
        }

        if (!recoveredWithFallback) {
            if (hasQueuedTracks) {
                await player.skip();
            } else {
                if (typeof player?.set === "function") {
                    player.set("suppressQueueEndNoticeUntil", Date.now() + 6000);
                }
                await player.stopPlaying(false, false).catch(() => {});
            }
        }

        if (channel) {
            if (recoveredWithFallback && fallbackTrack) {
                const fallbackTitle = getTrackTitle(fallbackTrack);
                const sourceLabel = formatSourceName(fallbackSource);
                const recoveredEmbed = new EmbedBuilder()
                    .setColor(client?.embedColor || "#ff0051")
                    .setDescription(
                        `**${trackTitle}** is unavailable on this source.\nSwitched to **${fallbackTitle}** from **${sourceLabel}**.`
                    );

                await channel.send({ embeds: [recoveredEmbed] }).catch(() => {});
            } else {
                const hint = getErrorHint(errorMessage);
                const lines = [
                    `An error occurred while playing **${trackTitle}**.`,
                    hint,
                    errorMessage ? `Reason: \`${normalizeText(errorMessage, 180)}\`` : null,
                ].filter(Boolean);

                const failedEmbed = new EmbedBuilder()
                    .setColor(client?.embedColor || "#ff0051")
                    .setDescription(lines.join("\n"));

                await channel.send({ embeds: [failedEmbed] }).catch(() => {});
            }
        }

        if (!player.voiceChannelId) {
            await player.destroy();
        }
    } catch (error) {
        console.error('[ERROR] trackError:', error.message);
    }
};
