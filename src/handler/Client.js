const { Client, EmbedBuilder } = require("discord.js");
const mongoose = require('mongoose');
const { readdirSync } = require("fs");
const formatDuration = require('../utils/formatDuration');
const sanitize = require('../utils/sanitize');
const GuildFilters = require('../schema/guildFilters');
const queueToolsModule = require('../utils/queue');
const { withTimeout } = require('../utils/promiseHandler');
const { reportStartupError } = require('../utils/errorHandler');

// Import all services
const Logger = require('../services/Logger');
const CommandErrorHandler = require('../services/CommandErrorHandler');
const cooldownManager = require('../utils/cooldownManager');

function toPositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeSlashCommandChoice(choice) {
    if (!choice || typeof choice !== 'object') return null;

    const normalized = {
        name: String(choice.name || ''),
        value: choice.value,
    };

    if (choice.nameLocalizations && typeof choice.nameLocalizations === 'object') {
        normalized.nameLocalizations = choice.nameLocalizations;
    }

    return normalized;
}

function normalizeSlashCommandOption(option) {
    if (!option || typeof option !== 'object') return null;

    const normalized = {
        type: Number(option.type || 0),
        name: String(option.name || ''),
    };

    if (typeof option.description === 'string' && option.description.length) {
        normalized.description = option.description;
    }
    if (option.required === true) normalized.required = true;
    if (option.autocomplete === true) normalized.autocomplete = true;
    if (option.minValue !== undefined) normalized.minValue = option.minValue;
    if (option.maxValue !== undefined) normalized.maxValue = option.maxValue;
    if (option.minLength !== undefined) normalized.minLength = option.minLength;
    if (option.maxLength !== undefined) normalized.maxLength = option.maxLength;

    if (Array.isArray(option.channelTypes) && option.channelTypes.length) {
        normalized.channelTypes = option.channelTypes.map((type) => Number(type));
    }

    if (Array.isArray(option.choices) && option.choices.length) {
        normalized.choices = option.choices
            .map(normalizeSlashCommandChoice)
            .filter(Boolean);
    }

    if (Array.isArray(option.options) && option.options.length) {
        normalized.options = option.options
            .map(normalizeSlashCommandOption)
            .filter(Boolean);
    }

    return normalized;
}

function normalizeSlashCommandDefinition(command) {
    if (!command || typeof command !== 'object' || !command.name) return null;

    const type = Number(command.type || 1);
    const normalized = {
        type,
        name: String(command.name),
    };

    if (type === 1) {
        normalized.description = String(command.description || '');
    }

    if (Array.isArray(command.options) && command.options.length) {
        normalized.options = command.options
            .map(normalizeSlashCommandOption)
            .filter(Boolean);
    }

    return normalized;
}

function serializeSlashCommandDefinitions(commands) {
    const normalized = (Array.isArray(commands) ? commands : [])
        .map(normalizeSlashCommandDefinition)
        .filter(Boolean)
        .sort((left, right) => {
            const typeDiff = Number(left.type || 0) - Number(right.type || 0);
            if (typeDiff !== 0) return typeDiff;
            return String(left.name || '').localeCompare(String(right.name || ''));
        });

    return JSON.stringify(normalized);
}

const DEFAULT_CORE_LAVALINK_WAIT_MS = toPositiveNumber(process.env.LAVALINK_COMMAND_WAIT_MS, 2500);
const DEFAULT_CORE_SEARCH_TIMEOUT_MS = toPositiveNumber(process.env.LAVALINK_SEARCH_TIMEOUT_MS, 3000);
const DEFAULT_CORE_VOICE_BRIDGE_TIMEOUT_MS = toPositiveNumber(process.env.LAVALINK_VOICE_BRIDGE_TIMEOUT_MS, 5000);
const DEFAULT_CORE_SEARCH_SOURCE_ORDER = ["spotify", "soundcloud", "applemusic", "deezer", "bandcamp"];
const CORE_SOURCE_SEARCH_ERROR_PATTERN = /has not '.*' enabled|has not .* enabled|required to have|Query \/ Link Provided for this Source/i;

const coreQueueTools = Object.freeze({
    getQueueArray(player) {
        if (!player) return [];
        return [
            player?.queue?.current,
            ...(Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [])
        ].filter(Boolean);
    },

    truncateText(value, maxLength = 60) {
        const text = String(value || "");
        if (text.length <= maxLength) return text;
        return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
    },

    escapeLinkLabel(value) {
        return String(value || "")
            .replace(/\\/g, "\\\\")
            .replace(/\[/g, "\\[")
            .replace(/\]/g, "\\]")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)");
    },

    getTrackUrl(track) {
        const url = String(
            track?.info?.uri ||
            track?.info?.url ||
            track?.uri ||
            track?.url ||
            ""
        ).trim();

        return /^https?:\/\//i.test(url) ? url : null;
    },

    getTrackThumbnail(track) {
        const candidates = [
            track?.info?.artworkUrl,
            track?.pluginInfo?.artworkUrl,
            track?.info?.thumbnail,
            track?.thumbnail,
        ];

        for (const candidate of candidates) {
            const value = String(candidate || "").trim();
            if (/^https?:\/\//i.test(value)) return value;
        }

        return null;
    },

    isLiveTrack(track) {
        return Boolean(track?.info?.isStream || track?.isStream);
    },

    getTrackDurationMs(track) {
        if (!track || coreQueueTools.isLiveTrack(track)) return null;
        const ms = Number(track?.info?.duration || track?.duration || 0);
        if (!Number.isFinite(ms) || ms <= 0) return null;
        return ms;
    },

    formatTrackLength(track) {
        if (coreQueueTools.isLiveTrack(track)) return "LIVE";
        const ms = coreQueueTools.getTrackDurationMs(track);
        if (!ms) return "Unknown";
        return formatDuration(ms, { verbose: false, unitCount: 2 });
    },

    formatQueueTrackTitle(track, maxLength = 60) {
        const title = coreQueueTools.truncateText(track?.info?.title || track?.title || "Unknown Title", maxLength);
        const url = coreQueueTools.getTrackUrl(track);
        return url ? `[${coreQueueTools.escapeLinkLabel(title)}](${url})` : title;
    },

    getRequesterInfo(track, options = {}) {
        const fallbackRequester = options.fallbackRequester || null;
        const fallbackRequesterId = options.fallbackRequesterId || null;
        const fallbackTag = options.fallbackTag || null;

        const id =
            track?.requester?.id ||
            track?.requester?.user?.id ||
            track?.info?.requester?.id ||
            (typeof track?.requester === "string" ? track.requester : null) ||
            fallbackRequester?.id ||
            fallbackRequester?.user?.id ||
            fallbackRequesterId ||
            null;

        const tag =
            track?.requester?.tag ||
            track?.requester?.user?.tag ||
            track?.info?.requester?.tag ||
            fallbackRequester?.tag ||
            fallbackRequester?.user?.tag ||
            fallbackTag ||
            "Unknown";

        return {
            id,
            tag,
            mention: id ? `<@${id}>` : null,
            label: id ? `<@${id}>` : tag,
        };
    },

    formatQueueTrackMeta(track, requesterLabel) {
        const author = coreQueueTools.truncateText(track?.info?.author || track?.author || "Unknown", 40);
        const duration = coreQueueTools.formatTrackLength(track);
        return `*by ${author} - ${duration} - ${requesterLabel || "Unknown"}*`;
    },

    sumTrackDurations(tracks) {
        const list = Array.isArray(tracks) ? tracks : [tracks];
        let totalMs = 0;
        let hasLive = false;

        for (const track of list.filter(Boolean)) {
            const durationMs = coreQueueTools.getTrackDurationMs(track);
            if (durationMs == null) {
                if (coreQueueTools.isLiveTrack(track)) hasLive = true;
                continue;
            }
            totalMs += durationMs;
        }

        return { totalMs, hasLive };
    },

    getQueueTiming(player, options = {}) {
        const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
        const tracks = coreQueueTools.getQueueArray(player);
        const current = tracks[0] || null;
        const upcoming = tracks.slice(1);

        const playerPosition = Math.max(0, Number(player?.position || player?.lastPosition || 0));
        const currentDurationMs = coreQueueTools.getTrackDurationMs(current);
        const remainingCurrentMs = currentDurationMs == null
            ? null
            : Math.max(0, currentDurationMs - Math.min(playerPosition, currentDurationMs));

        const upcomingDurations = coreQueueTools.sumTrackDurations(upcoming);
        const totalDurations = coreQueueTools.sumTrackDurations(tracks);
        const remainingKnownMs = (remainingCurrentMs || 0) + upcomingDurations.totalMs;
        const hasLive = Boolean(
            (current && coreQueueTools.isLiveTrack(current)) ||
            upcomingDurations.hasLive
        );

        return {
            current,
            upcoming,
            totalTracks: tracks.length,
            upcomingTracks: upcoming.length,
            currentDurationMs,
            remainingCurrentMs,
            upcomingDurationMs: upcomingDurations.totalMs,
            totalDurationMs: totalDurations.totalMs,
            remainingKnownMs,
            hasLive,
            finishAt: !hasLive && remainingKnownMs > 0 ? now + remainingKnownMs : null,
        };
    },

    formatDurationLabel(milliseconds) {
        const raw = Number(milliseconds);
        if (!Number.isFinite(raw) || raw <= 0) return "0s";
        return formatDuration(raw, { verbose: false, unitCount: 3 });
    },

    formatDiscordTimestamp(timestampMs, style = "t") {
        const raw = Number(timestampMs);
        if (!Number.isFinite(raw) || raw <= 0) return null;
        return `<t:${Math.floor(raw / 1000)}:${style}>`;
    },
});

const coreFilterSettings = Object.freeze({
    async getFilter(guildId, name) {
        if (!guildId || !name) return false;
        try {
            const doc = await GuildFilters.findOne({ guildId }).lean();
            return !!(doc && doc.filters && doc.filters[name]);
        } catch (_e) {
            return false;
        }
    },

    async setFilter(guildId, name, value) {
        if (!guildId || !name) return null;
        try {
            const update = {};
            update[`filters.${name}`] = !!value;
            return await GuildFilters.findOneAndUpdate(
                { guildId },
                { $set: update },
                { upsert: true, returnDocument: "after" }
            );
        } catch (_e) {
            return null;
        }
    },
});

const coreFilterTools = Object.freeze({
    getEqualizerBands(player) {
        const bands = Array.isArray(player?.bands) ? player.bands : new Array(15).fill(0);
        return bands.map((gain, index) => ({
            band: Number(index),
            gain: Number(gain) || 0,
        }));
    },

    canUseRawFilters(player) {
        return Boolean(player?.node && typeof player.node.send === 'function');
    },

    sendRawFilters(player, guildId, filters = {}) {
        if (!coreFilterTools.canUseRawFilters(player) || !guildId) return false;

        player.node.send({
            op: 'filters',
            guildId,
            equalizer: coreFilterTools.getEqualizerBands(player),
            ...filters,
        });

        return true;
    },

    async resetPlayerFilters(player, guildId) {
        if (!player) return false;

        if (typeof player.reset === 'function') {
            try {
                await player.reset();
                return true;
            } catch (_error) {}
        }

        if (typeof player.clearEQ === 'function') {
            try {
                player.clearEQ();
            } catch (_error) {}
        }

        return coreFilterTools.sendRawFilters(player, guildId, {});
    },
});

function buildCoreErrorEmbed(client, text) {
    return new EmbedBuilder()
        .setColor(client?.embedColor || '#ff0051')
        .setDescription(text);
}

function normalizeCoreSourceName(source) {
    const value = String(source || "").trim().toLowerCase();
    if (!value) return null;

    if (['spotify', 'spsearch', 'sp'].includes(value)) return 'spotify';
    if (['soundcloud', 'scsearch', 'sc'].includes(value)) return 'soundcloud';
    if (['applemusic', 'apple', 'apple music', 'amsearch', 'am'].includes(value)) return 'applemusic';
    if (['deezer', 'dzsearch', 'dz', 'dzisrc'].includes(value)) return 'deezer';
    if (['bandcamp', 'bcsearch', 'bc'].includes(value)) return 'bandcamp';

    return value;
}

function uniqueCoreSources(list) {
    return [...new Set((Array.isArray(list) ? list : [list]).map(normalizeCoreSourceName).filter(Boolean))];
}

function orderCoreSourcesForPlayer(player, preferredSources = DEFAULT_CORE_SEARCH_SOURCE_ORDER) {
    const ordered = uniqueCoreSources(preferredSources);
    const preferred = normalizeCoreSourceName(
        typeof player?.get === 'function' ? player.get('preferredSearchSource') : null
    );

    if (!preferred || !ordered.includes(preferred)) {
        return ordered;
    }

    return [preferred, ...ordered.filter((source) => source !== preferred)];
}

function getAvailableCoreSearchSources(client, player, preferredSources = DEFAULT_CORE_SEARCH_SOURCE_ORDER) {
    const preferred = orderCoreSourcesForPlayer(player, preferredSources);
    const nodes = [];

    if (player?.node) nodes.push(player.node);

    for (const node of Array.from(client?.lavalink?.nodeManager?.nodes?.values?.() || [])) {
        if (!nodes.includes(node)) nodes.push(node);
    }

    const advertisedSources = new Set();
    let hasNodeInfo = false;

    for (const node of nodes) {
        if (!Array.isArray(node?.info?.sourceManagers)) continue;
        hasNodeInfo = true;

        for (const source of node.info.sourceManagers) {
            const normalized = normalizeCoreSourceName(source);
            if (normalized) advertisedSources.add(normalized);
        }
    }

    return {
        sources: hasNodeInfo ? preferred.filter((source) => advertisedSources.has(source)) : preferred,
        advertisedSources: [...advertisedSources],
        hasNodeInfo,
    };
}

function formatCoreSourceList(sources) {
    return Array.isArray(sources) && sources.length ? sources.join(', ') : 'none';
}

function isCoreTimeoutLikeError(error) {
    return /timeout|timed out|aborted/i.test(String(error?.message || error || ''));
}

function shouldSuppressCoreSourceSearchError(error) {
    return CORE_SOURCE_SEARCH_ERROR_PATTERN.test(String(error?.message || error || ''));
}

async function waitForCoreVoiceBridge({ player, guild, channelId, timeoutMs = DEFAULT_CORE_VOICE_BRIDGE_TIMEOUT_MS, pollIntervalMs = 200 }) {
    const startedAt = Date.now();

    while ((Date.now() - startedAt) < timeoutMs) {
        const botChannelId = guild?.members?.me?.voice?.channelId || null;
        const hasVoiceBridge = Boolean(
            player?.voice?.sessionId &&
            player?.voice?.token &&
            player?.voice?.endpoint
        );

        if (botChannelId === channelId && hasVoiceBridge) {
            return true;
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return false;
}

async function ensureCorePlayerPlayback(client, {
    player,
    guild,
    channelId,
    directTrack = null,
    timeoutMs = DEFAULT_CORE_VOICE_BRIDGE_TIMEOUT_MS,
    recoverVolume = true,
} = {}) {
    try {
        if (!player || !guild || !channelId) return false;

        if (player?.state !== 'CONNECTED' || guild?.members?.me?.voice?.channelId !== channelId) {
            await player.connect();
        }

        const hasVoiceBridge = Boolean(
            player?.voice?.sessionId &&
            player?.voice?.token &&
            player?.voice?.endpoint &&
            guild?.members?.me?.voice?.channelId === channelId
        );

        if (!hasVoiceBridge) {
            const voiceReady = await waitForCoreVoiceBridge({ player, guild, channelId, timeoutMs });
            if (!voiceReady) return false;
        }

        if (recoverVolume) {
            try {
                const currentVolume = Number(player.volume ?? player?.options?.volume ?? 100);
                if (Number.isFinite(currentVolume) && currentVolume <= 0) {
                    await player.setVolume(100);
                }
            } catch (_error) {}
        }

        if (directTrack) {
            await player.play({ clientTrack: directTrack, paused: false });
        } else {
            await player.play({ paused: false });
        }

        return true;
    } catch (error) {
        client?.logger?.log?.(`ensurePlayerPlayback error: ${error?.message || error}`, 'error');
        return false;
    }
}

async function searchCoreWithAvailableSources(client, {
    player,
    queryText,
    requester,
    preferredSources = DEFAULT_CORE_SEARCH_SOURCE_ORDER,
    timeoutMs = DEFAULT_CORE_SEARCH_TIMEOUT_MS,
    logPrefix = 'Search',
    maxSourceAttempts = 2,
    rememberPreferredSource = true,
} = {}) {
    const availability = getAvailableCoreSearchSources(client, player, preferredSources);
    const attemptLimit = Math.max(1, Number(maxSourceAttempts) || 1);
    const attemptedSources = availability.sources.slice(0, attemptLimit);
    let lastError = null;

    if (!attemptedSources.length) {
        return {
            result: null,
            attemptedSources,
            advertisedSources: availability.advertisedSources,
            hasNodeInfo: availability.hasNodeInfo,
            lastError: new Error(
                availability.hasNodeInfo
                    ? `No supported search sources are enabled on this Lavalink node. Available sources: ${formatCoreSourceList(availability.advertisedSources)}`
                    : 'No searchable sources are available yet.'
            ),
            matchedSource: null,
        };
    }

    for (const source of attemptedSources) {
        try {
            const result = await withTimeout(
                player.search({ query: queryText, source }, requester),
                timeoutMs,
                `${source} search timeout`
            );

            if (result?.loadType === 'LOAD_FAILED') {
                throw result.exception || new Error(`${source} search failed`);
            }

            if (result?.tracks?.length) {
                if (rememberPreferredSource && typeof player?.set === 'function') {
                    player.set('preferredSearchSource', source);
                }

                return {
                    result,
                    attemptedSources,
                    advertisedSources: availability.advertisedSources,
                    hasNodeInfo: availability.hasNodeInfo,
                    lastError: null,
                    matchedSource: source,
                };
            }
        } catch (error) {
            lastError = error;
            if (!shouldSuppressCoreSourceSearchError(error)) {
                client?.logger?.log?.(`${logPrefix} failed for ${source}: ${error?.message || error}`, 'warn');
            }
        }
    }

    return {
        result: null,
        attemptedSources,
        advertisedSources: availability.advertisedSources,
        hasNodeInfo: availability.hasNodeInfo,
        lastError,
        matchedSource: null,
    };
}

async function runCoreMusicChecks(client, interaction, options = {}) {
    if (!interaction || !client) {
        return {
            valid: false,
            embed: buildCoreErrorEmbed(client, 'Internal validation error. Please try again.')
        };
    }

    const requireInVoice = options.inVoiceChannel !== undefined ? options.inVoiceChannel : true;
    const requireBotInVoice = options.botInVoiceChannel !== undefined ? options.botInVoiceChannel : true;
    const requireSameVoice = options.sameChannel !== undefined
        ? options.sameChannel
        : (options.sameVoiceChannel !== undefined
            ? options.sameVoiceChannel
            : (options.requireSameVoice !== undefined ? options.requireSameVoice : true));
    const requirePlayerCheck = options.requirePlayer !== undefined ? options.requirePlayer : true;
    const requireQueue = options.requireQueue !== undefined ? options.requireQueue : false;

    const userChannel = interaction?.member?.voice?.channel || null;
    if (requireInVoice && !userChannel) {
        return {
            valid: false,
            embed: buildCoreErrorEmbed(client, 'You must be in a voice channel to use this command.')
        };
    }

    const guild = interaction?.guild || null;
    const botMember = guild?.members?.cache?.get?.(client?.user?.id) || null;
    const botChannel = botMember?.voice?.channel || null;

    if (requireBotInVoice) {
        if (!guild || !client?.user?.id) {
            return {
                valid: false,
                embed: buildCoreErrorEmbed(client, 'This command can only be used in a server.')
            };
        }

        if (!botChannel) {
            return {
                valid: false,
                embed: buildCoreErrorEmbed(client, 'Bot is not in a voice channel.')
            };
        }
    }

    if (requireSameVoice) {
        if (!userChannel) {
            return {
                valid: false,
                embed: buildCoreErrorEmbed(client, 'You must be in a voice channel.')
            };
        }

        if (!botChannel) {
            return {
                valid: false,
                embed: buildCoreErrorEmbed(client, 'Bot is not in a voice channel.')
            };
        }

        if (userChannel.id !== botChannel.id) {
            return {
                valid: false,
                embed: buildCoreErrorEmbed(client, 'You must be in the same voice channel as the bot.')
            };
        }
    }

    let player = null;
    if (requirePlayerCheck || requireQueue) {
        if (!client?.lavalink) {
            return {
                valid: false,
                embed: buildCoreErrorEmbed(client, 'Lavalink is not initialized.')
            };
        }

        if (!client.lavalink.useable && typeof client.waitForLavalinkReady === 'function') {
            try {
                await client.waitForLavalinkReady(DEFAULT_CORE_LAVALINK_WAIT_MS);
            } catch (_err) {}
        }

        if (!client.lavalink.useable) {
            return {
                valid: false,
                embed: buildCoreErrorEmbed(client, 'No Lavalink node is available right now. Please try again in a moment.')
            };
        }

        player = client.lavalink.players.get(interaction.guildId);
        if (!player) {
            return {
                valid: false,
                embed: buildCoreErrorEmbed(client, 'No player active. Use /play to start music.')
            };
        }
    }

    if (requireQueue) {
        const queue = coreQueueTools.getQueueArray(player);
        if (!queue.length) {
            return {
                valid: false,
                embed: buildCoreErrorEmbed(client, 'Queue is empty.')
            };
        }

        return { valid: true, player, queue };
    }

    return { valid: true, player };
}


/**
 * @param {Client} client
 */
module.exports = async (client) => {
    if (!(client.logger instanceof Logger)) {
        client.logger = new Logger(client);
    } else {
        client.logger.client = client;
    }

    client.core = client.core || {};
    client.core.queue = queueToolsModule;
    client.core.filterSettings = coreFilterSettings;
    client.core.filters = coreFilterTools;
    client.core.music = Object.freeze({
        DEFAULT_SEARCH_SOURCE_ORDER: DEFAULT_CORE_SEARCH_SOURCE_ORDER,
        formatSourceList: formatCoreSourceList,
        isTimeoutLikeError: isCoreTimeoutLikeError,
        getAvailableSearchSources(player, preferredSources = DEFAULT_CORE_SEARCH_SOURCE_ORDER) {
            return getAvailableCoreSearchSources(client, player, preferredSources);
        },
        async searchWithAvailableSources(options = {}) {
            return searchCoreWithAvailableSources(client, options);
        },
        async ensurePlayerPlayback(options = {}) {
            return ensureCorePlayerPlayback(client, options);
        },
    });
    client.runMusicChecks = async (interaction, options = {}) => runCoreMusicChecks(client, interaction, options);

    client.on("raw", (d) => {
        if (!client.lavalink) return;

        try {
            client.lavalink.sendRawData(d);
        } catch (_e) {}
    });

    // Safe logger wrapper: prefer client.logger if available, fall back to console.
    // Output stays one-line and structured to avoid noisy startup logs.
    const safeLog = (message, type = 'info') => {
        const normalizedType = ['ready', 'success'].includes(String(type).toLowerCase()) ? 'info' : String(type || 'info').toLowerCase();
        const safeMessage = sanitize(String(message ?? "").replace(/\s+/g, " ").trim());
        if (!safeMessage) return;

        try {
            if (client && client.logger && typeof client.logger.log === 'function') {
                client.logger.log(safeMessage, normalizedType);
                return;
            }
        } catch (_e) {}

        const line = `[${new Date().toISOString()}] [${normalizedType.toUpperCase()}] ${safeMessage}`;
        if (normalizedType === 'error' || normalizedType === 'fatal' || normalizedType === 'critical') {
            console.error(line);
            return;
        }
        if (normalizedType === 'warn' || normalizedType === 'warning') {
            console.warn(line);
            return;
        }
        console.log(line);
    };

    const reportBootstrapError = (error, context = {}) => {
        reportStartupError(client, error, context).catch(() => {});
    };

    /**
     * MongoDB connection (resilient reconnect + health checks)
     */
    const dbOptions = {
        autoIndex: false,
        connectTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000,
        family: 4,
    };

    const mongoUrl = process.env.MONGODB_URL || process.env.MONGOURI || client.config.mongourl;
    const hasValidMongoUrl = Boolean(
        mongoUrl &&
        typeof mongoUrl === 'string' &&
        mongoUrl.startsWith('mongodb')
    );

    const mongoState = {
        connecting: false,
        reconnectTimer: null,
        healthTimer: null,
        reconnectAttempts: 0,
        healthy: false,
    };

    const MONGO_HEALTH_CHECK_MS = Number(process.env.MONGO_HEALTH_CHECK_MS || 60000);
    const MONGO_MAX_RECONNECT_DELAY_MS = Number(process.env.MONGO_MAX_RECONNECT_DELAY_MS || 60000);

    const isMongoConnected = () => mongoose.connection.readyState === 1;

    const clearMongoReconnectTimer = () => {
        if (mongoState.reconnectTimer) {
            clearTimeout(mongoState.reconnectTimer);
            mongoState.reconnectTimer = null;
        }
    };

    const scheduleMongoReconnect = (reason = 'unknown') => {
        if (!hasValidMongoUrl || mongoState.reconnectTimer || mongoState.connecting || isMongoConnected()) {
            return;
        }

        mongoState.reconnectAttempts += 1;
        const backoff = Math.min(
            1000 * Math.pow(2, Math.max(0, mongoState.reconnectAttempts - 1)),
            MONGO_MAX_RECONNECT_DELAY_MS
        );
        const jitter = Math.floor(Math.random() * 750);
        const delay = backoff + jitter;

        safeLog(`[MONGO] Reconnect attempt ${mongoState.reconnectAttempts} in ${delay}ms (${reason}).`, 'warn');
        mongoState.reconnectTimer = setTimeout(() => {
            mongoState.reconnectTimer = null;
            connectMongo('scheduled-reconnect').catch(() => {});
        }, delay);

        if (mongoState.reconnectTimer && typeof mongoState.reconnectTimer.unref === 'function') {
            mongoState.reconnectTimer.unref();
        }
    };

    const connectMongo = async (reason = 'startup') => {
        if (!hasValidMongoUrl) return false;
        if (mongoState.connecting) return false;

        const state = mongoose.connection.readyState;
        if (state === 1 || state === 2) {
            return state === 1;
        }

        mongoState.connecting = true;

        try {
            await mongoose.connect(mongoUrl, dbOptions);
            await mongoose.connection.db.admin().ping();

            mongoState.healthy = true;
            mongoState.reconnectAttempts = 0;
            clearMongoReconnectTimer();

            return true;
        } catch (err) {
            mongoState.healthy = false;
            safeLog(`[MONGO] Connection failed (${reason}): ${err && (err.message || err)}`, 'error');
            if (reason === 'startup') {
                reportBootstrapError(err, { stage: 'mongo-connect' });
            }
            scheduleMongoReconnect('connect-failed');
            return false;
        } finally {
            mongoState.connecting = false;
        }
    };

    const startMongoHealthChecks = () => {
        if (!hasValidMongoUrl || mongoState.healthTimer) return;

        mongoState.healthTimer = setInterval(async () => {
            if (!isMongoConnected()) {
                mongoState.healthy = false;
                scheduleMongoReconnect('healthcheck-disconnected');
                return;
            }

            try {
                await mongoose.connection.db.admin().ping();
                if (!mongoState.healthy) {
                    safeLog('[MONGO] Connection recovered and ping is healthy.', 'info');
                }
                mongoState.healthy = true;
            } catch (err) {
                mongoState.healthy = false;
                safeLog(`[MONGO] Health check ping failed: ${err && (err.message || err)}`, 'warn');
                scheduleMongoReconnect('healthcheck-ping-failed');
            }
        }, MONGO_HEALTH_CHECK_MS);

        if (mongoState.healthTimer && typeof mongoState.healthTimer.unref === 'function') {
            mongoState.healthTimer.unref();
        }
    };

    if (hasValidMongoUrl) {
        connectMongo('startup').catch(() => {});
        startMongoHealthChecks();
    } else {
        safeLog('[WARN] No valid MongoDB URL provided. Database features will be unavailable.', 'warn');
    }

    mongoose.connection.on('connected', () => {
        mongoState.healthy = true;
        mongoState.reconnectAttempts = 0;
        clearMongoReconnectTimer();
        safeLog('[MONGO] Connected successfully.', 'info');
    });

    mongoose.connection.on('reconnected', () => {
        mongoState.healthy = true;
        mongoState.reconnectAttempts = 0;
        clearMongoReconnectTimer();
        safeLog('[MONGO] Reconnected successfully.', 'info');
    });

    mongoose.connection.on('error', (err) => {
        mongoState.healthy = false;
        safeLog(`[MONGO] Connection error: ${err && (err.message || err)}`, 'error');
        scheduleMongoReconnect('mongoose-error');
    });

    mongoose.connection.on('disconnected', () => {
        mongoState.healthy = false;
        safeLog('MongoDB disconnected.', 'warn');
        scheduleMongoReconnect('mongoose-disconnected');
    });

    /**
     * Error Handler
     */
    client.on("disconnect", () => safeLog("Bot is disconnecting...", 'warn'))
    client.on("reconnecting", () => safeLog("Bot reconnecting...", 'warn'))
    client.on('warn', error => { safeLog(`[CLIENT] ${error && (error.message || error.toString())}`, 'warn'); });
    client.on('error', error => { safeLog(`[CLIENT] ${error && (error.message || error.toString())}`, 'error'); });
    // process-level handlers are registered in src/bot.js to avoid duplicate logging

 /**
 * Client Events
 */
// Load Client event handlers and report which files were loaded
try {
    const clientEventFiles = readdirSync("./src/events/Client/");
    clientEventFiles.forEach(file => {
        try {
            const event = require(`../events/Client/${file}`);
            let eventName = file.split(".")[0];

            // Discord.js v15 removes the deprecated `ready` event name.
            // Route ready.js to `clientReady` now, while keeping other events unchanged.
            if (eventName === 'ready') {
                client.on('clientReady', event.bind(null, client));
            } else {
                client.on(eventName, event.bind(null, client));
            }
        } catch (err) {
            safeLog(`[ERROR] Failed to load Client event file ${file}: ${err && (err.stack || err.message || err)}`, 'error');
            reportBootstrapError(err, { stage: `client-event:${file}` });
        }
    });
} catch (err) {
    safeLog(`[ERROR] Unable to read Client events folder: ${err && (err.stack || err.message || err)}`, 'error');
    reportBootstrapError(err, { stage: 'client-events-folder' });
}

const data = [];
try {
    readdirSync("./src/slashCommands/").forEach((dir) => {
        const slashCommandFile = readdirSync(`./src/slashCommands/${dir}/`).filter((files) => files.endsWith(".js"));

        for (const file of slashCommandFile) {
            try {
                const slashCommand = require(`../slashCommands/${dir}/${file}`);
                try { slashCommand._filename = `src/slashCommands/${dir}/${file}`; } catch (_e) {}

                if (!slashCommand.name) {
                    throw new Error(`Slash command name is required for ${dir}/${file}`);
                }

                if (!slashCommand.description) {
                    throw new Error(`Slash command description is required for ${dir}/${file}`);
                }

                client.sls.set(slashCommand.name, slashCommand);
                data.push(slashCommand);
            } catch (err) {
                safeLog(`[COMMANDS] Failed to load slash command ${dir}/${file}: ${err && (err.message || err)}`, 'error');
                reportBootstrapError(err, { stage: `slash-command:${dir}/${file}` });
            }
        }
    });
} catch (err) {
    safeLog(`[COMMANDS] Unable to read slash commands folder: ${err && (err.message || err)}`, 'error');
    reportBootstrapError(err, { stage: 'slash-commands-folder' });
}

try {
    readdirSync("./src/commands/").forEach((dir) => {
        const fullDir = `./src/commands/${dir}/`;
        const CommandFile = readdirSync(fullDir).filter((files) => files.endsWith(".js"));

        for (const file of CommandFile) {
            try {
                const command = require(`../commands/${dir}/${file}`);
                if (!command.name) continue;
                try { command._filename = `src/commands/${dir}/${file}`; } catch (_e) {}
                const commandName = command.name.toLowerCase();
                client.commands.set(commandName, command);
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach((alias) => {
                        const aliasKey = String(alias).toLowerCase();
                        const existing = client.aliases.get(aliasKey);
                        if (existing && existing !== commandName) {
                            safeLog(`[WARN] Alias collision skipped: "${aliasKey}" already mapped to "${existing}", ignoring "${commandName}"`, 'warn');
                            return;
                        }
                        if (client.commands.has(aliasKey) && aliasKey !== commandName) {
                            safeLog(`[WARN] Alias collision skipped: "${aliasKey}" matches command name, ignoring alias for "${commandName}"`, 'warn');
                            return;
                        }
                        client.aliases.set(aliasKey, commandName);
                    });
                }
            } catch (err) {
                safeLog(`[COMMANDS] Failed to load command ${dir}/${file}: ${err && (err.message || err)}`, 'error');
                reportBootstrapError(err, { stage: `command:${dir}/${file}` });
            }
        }

        const subDirs = readdirSync(fullDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        subDirs.forEach(subDir => {
            const subCommandFiles = readdirSync(`${fullDir}${subDir}/`).filter((files) => files.endsWith(".js"));
            for (const file of subCommandFiles) {
                try {
                    const command = require(`../commands/${dir}/${subDir}/${file}`);
                    if (!command.name) continue;
                    try { command._filename = `src/commands/${dir}/${subDir}/${file}`; } catch (_e) {}
                    const commandName = command.name.toLowerCase();
                    client.commands.set(commandName, command);
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach((alias) => {
                            const aliasKey = String(alias).toLowerCase();
                            const existing = client.aliases.get(aliasKey);
                            if (existing && existing !== commandName) {
                                safeLog(`[WARN] Alias collision skipped: "${aliasKey}" already mapped to "${existing}", ignoring "${commandName}"`, 'warn');
                                return;
                            }
                            if (client.commands.has(aliasKey) && aliasKey !== commandName) {
                                safeLog(`[WARN] Alias collision skipped: "${aliasKey}" matches command name, ignoring alias for "${commandName}"`, 'warn');
                                return;
                            }
                            client.aliases.set(aliasKey, commandName);
                        });
                    }
                } catch (err) {
                    safeLog(`[COMMANDS] Failed to load nested command ${dir}/${subDir}/${file}: ${err && (err.message || err)}`, 'error');
                    reportBootstrapError(err, { stage: `command:${dir}/${subDir}/${file}` });
                }
            }
        });
    });
} catch (err) {
    safeLog(`[COMMANDS] Unable to read commands folder: ${err && (err.message || err)}`, 'error');
    reportBootstrapError(err, { stage: 'commands-folder' });
}

    // The discord.js v15 ready event was renamed to `clientReady`. Register the
    // same initialization for both event names to remain backwards compatible
    // and avoid the deprecation warning.
    client.once("clientReady", async () => {
        safeLog(`[DISCORD] Connected: ${client.user && client.user.tag ? client.user.tag : client.user}`, 'info');

        // Register global slash commands on ready (independent of Lavalink)
        try {
            if (Array.isArray(data) && data.length > 0) {
                if (client.application && client.application.commands && typeof client.application.commands.set === 'function') {
                    const desiredDefinitions = data
                        .map(normalizeSlashCommandDefinition)
                        .filter(Boolean);

                    const registerIfChanged = async () => {
                        const currentCommands = await client.application.commands.fetch().catch(() => null);
                        const currentDefinitions = currentCommands
                            ? Array.from(currentCommands.values()).map((command) => normalizeSlashCommandDefinition(command))
                            : [];

                        if (serializeSlashCommandDefinitions(currentDefinitions) === serializeSlashCommandDefinitions(desiredDefinitions)) {
                            safeLog(`[COMMANDS] Slash commands already up to date | count=${desiredDefinitions.length}`, 'info');
                            return;
                        }

                        await client.application.commands.set(desiredDefinitions);
                        safeLog(`[COMMANDS] Slash commands registered | count=${desiredDefinitions.length}`, 'info');
                    };

                    registerIfChanged().catch((e) => {
                        safeLog(`[COMMANDS] Failed to register slash commands: ${e && (e.message || e.toString())}`, 'error');
                        reportBootstrapError(e, { stage: 'slash-register' });
                    });
                } else {
                    safeLog('[COMMANDS] Slash registration skipped: client.application.commands unavailable', 'warn');
                }
            } else {
                safeLog('[COMMANDS] No slash commands to register', 'info');
            }
        } catch (e) {
            safeLog(`[COMMANDS] Registration error: ${e && (e.message || e.toString())}`, 'error');
            reportBootstrapError(e, { stage: 'slash-register' });
        }
        // Lavalink setup is performed from src/events/Client/ready.js, which
        // also runs on clientReady. This block only handles Discord startup
        // logging and slash command registration.
    });
    client.once("clientReady", async () => {
        try {
            // 1. Ensure structured logger is available
            if (!(client.logger instanceof Logger)) {
                client.logger = new Logger(client);
            } else {
                client.logger.client = client;
            }

            // 2. Initialize CommandErrorHandler
            client.errorHandler = new CommandErrorHandler(client);

            // 3. Attach cooldownManager (singleton pattern, no .start() needed)
            client.cooldownManager = cooldownManager;
            safeLog('[SERVICES] Core services ready', 'info');
            safeLog('[READY] All systems initialized and ready', 'info');

        } catch (e) {
            safeLog(`Initialization failed: ${e && (e.message || e.toString())}`, 'error');
            reportBootstrapError(e, { stage: 'core-services' });
        }
    });

    // Graceful shutdown
    const handleShutdown = async (signal) => {
        try {
            safeLog(`[SHUTDOWN] Received ${signal}. Cleaning up resources...`, 'info');

            if (mongoState.healthTimer) {
                clearInterval(mongoState.healthTimer);
                mongoState.healthTimer = null;
            }
            clearMongoReconnectTimer();

            if (mongoose.connection.readyState !== 0) {
                await mongoose.connection.close().catch(() => {});
            }

            if (client.logger && typeof client.logger.stop === 'function') {
                client.logger.stop(); // Flush logger buffers if supported
            }

            safeLog('[SHUTDOWN] Bot shutdown complete.', 'info');
            process.exit(0);
        } catch (err) {
            console.error('[SHUTDOWN] Error during shutdown:', err && (err.message || err));
            process.exit(1);
        }
    };

    process.on('SIGINT', () => { handleShutdown('SIGINT'); });
    process.on('SIGTERM', () => { handleShutdown('SIGTERM'); });

}
