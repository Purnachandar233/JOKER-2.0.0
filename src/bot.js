require('dotenv').config({ quiet: true });
const crypto = require("node:crypto");
const { Client, GatewayIntentBits, Partials, Collection, ActivityType, Options } = require("discord.js");
const express = require("express");
const { recordTopggVote } = require("./utils/topggVoteSync");
const Logger = require("./services/Logger");

function normalizeUrl(value, fallback) {
    const text = String(value || "").trim();
    return text || fallback;
}

function trimTrailingSlash(value) {
    return String(value || "").replace(/\/+$/, "");
}

function captureRawBody(req, _res, buf, encoding) {
    req.rawBody = buf?.length ? buf.toString(encoding || "utf8") : "";
}

function timingSafeHexEqual(left, right) {
    const normalizedLeft = String(left || "").trim().toLowerCase();
    const normalizedRight = String(right || "").trim().toLowerCase();
    if (!normalizedLeft || !normalizedRight || normalizedLeft.length !== normalizedRight.length) {
        return false;
    }

    try {
        return crypto.timingSafeEqual(
            Buffer.from(normalizedLeft, "hex"),
            Buffer.from(normalizedRight, "hex")
        );
    } catch (_err) {
        return false;
    }
}

function parseTopggSignature(headerValue) {
    const parts = String(headerValue || "")
        .split(",")
        .map((part) => String(part || "").trim())
        .filter(Boolean);

    const parsed = {};
    for (const part of parts) {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex <= 0) continue;
        const key = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        if (key && value) parsed[key] = value;
    }
    return parsed;
}

function verifyTopggV2Signature(req, secret) {
    const parsedSignature = parseTopggSignature(req.get("x-topgg-signature"));
    const timestamp = parsedSignature.t;
    const providedSignature = parsedSignature.v1;
    const rawBody = typeof req.rawBody === "string"
        ? req.rawBody
        : JSON.stringify(req.body || {});

    if (!timestamp || !providedSignature || !rawBody) {
        return { ok: false, reason: "missing_signature_fields" };
    }

    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");

    return {
        ok: timingSafeHexEqual(providedSignature, expectedSignature),
        reason: "signature_mismatch",
    };
}

function parseTopggWebhookTime(value, fallback) {
    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? parsed : fallback;
}

async function handleTopggVoteEvent(userId, options = {}) {
    const source = String(options.source || "webhook");
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const expireAt = Number.isFinite(Number(options.expireAt)) ? Number(options.expireAt) : undefined;
    const voteWeight = Math.max(1, Math.floor(Number(options.voteWeight) || 1));
    const voteUserId = String(userId || "").trim();

    if (!voteUserId) {
        console.warn(`[TOPGG] Ignored ${source} vote without user id.`);
        return null;
    }

    console.log(`[TOPGG] Vote received from ${source} for ${voteUserId}`);

    const voteResult = await recordTopggVote(voteUserId, {
        now,
        expireAt,
        voteWeight,
        source,
        client,
        notifyUser: true,
    });

    if (voteResult.voteGrant.status === "kept_permanent") {
        console.log(`[TOPGG] Vote recorded for ${voteUserId}. Existing permanent premium kept.`);
    } else if (voteResult.voteGrant.status === "extended" || voteResult.voteGrant.status === "created" || voteResult.voteGrant.status === "renewed") {
        console.log(`[TOPGG] Vote premium active for ${voteUserId} until ${new Date(voteResult.voteGrant.expire).toISOString()}`);
    } else if (voteResult.voteGrant.status === "expired") {
        console.log(`[TOPGG] Vote for ${voteUserId} was recorded after its premium window had already expired.`);
    } else {
        console.log(`[TOPGG] Vote recorded for ${voteUserId}. Premium window unchanged.`);
    }

    return voteResult;
}

function buildLegalLinks(config = {}) {
    const websiteUrl = trimTrailingSlash(
        normalizeUrl(process.env.WEBSITE_URL, config.websiteUrl || "https://jokerbot.com")
    );

    return {
        websiteUrl,
        privacyPolicyUrl: normalizeUrl(
            process.env.PRIVACY_POLICY_URL,
            config.privacyPolicyUrl || `${websiteUrl}/privacy`
        ),
        termsOfServiceUrl: normalizeUrl(
            process.env.TERMS_OF_SERVICE_URL,
            config.termsOfServiceUrl || `${websiteUrl}/terms`
        ),
        privacyContactEmail: normalizeUrl(
            process.env.PRIVACY_CONTACT_EMAIL,
            config.privacyContactEmail || "privacy@jokerbot.com"
        ),
        supportServerUrl: normalizeUrl(
            process.env.SUPPORT_SERVER_URL,
            config.supportServerUrl || "https://discord.gg/JQzBqgmwFm"
        ),
    };
}

const MESSAGE_SWEEP_INTERVAL_SECONDS = 5 * 60;
const MESSAGE_CACHE_LIFETIME_SECONDS = 15 * 60;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
        
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
    makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        MessageManager: 100,
        ReactionManager: 0,
        PresenceManager: 0,
        ThreadManager: 50,
        ThreadMemberManager: 0,
        UserManager: 1000,
        GuildMemberManager: {
            maxSize: 500,
            keepOverLimit: (member) => member.id === member.client.user?.id,
        },
    }),
    sweepers: {
        ...Options.DefaultSweeperSettings,
        messages: {
            interval: MESSAGE_SWEEP_INTERVAL_SECONDS,
            lifetime: MESSAGE_CACHE_LIFETIME_SECONDS,
        },
    }
});

// Warn about privileged intents (enable in Developer Portal)
try {
    const intents = client.options.intents;
    if (intents && (intents.has && (intents.has(GatewayIntentBits.MessageContent) || intents.has(GatewayIntentBits.GuildMembers)))) {
        console.warn('[WARN] Bot requests privileged intents (Message Content / Guild Members). Enable them in the Developer Portal.');
    }
} catch (e) {}

module.exports = client;
client.commands = new Collection();
client.aliases = new Collection();
client.sls = new Collection();
client.config = require("../config.json");
client.owner = String(process.env.OWNERID || "").trim();
client.prefix = process.env.PREFIX || client.config.prefix;
client.embedColor = client.config.embedColor;
client.legalLinks = Object.freeze(buildLegalLinks(client.config));
client.cooldowns = new Collection();
client.logger = new Logger(client);

require("./handler/Client")(client);
// NOTE: Global listener limits removed. If you see "MaxListenersExceededWarning",
// investigate and fix listener leaks instead of increasing this limit.
// See: https://nodejs.org/en/docs/guides/nodejs-performance-measurements/

const token = process.env.TOKEN || client.config.token;
if (!token || token === "DISCORD_BOT_TOKEN") {
    console.error("[ERROR] No Discord bot token provided. Please set the TOKEN secret or add it to config.json.");
    process.exit(1);
}

client.login(token);
// ================= TOP.GG VOTE PREMIUM SYSTEM =================

const app = express();
app.use(express.json({ verify: captureRawBody }));
app.get("/topgg/health", (_req, res) => {
    res.status(200).json({ ok: true });
});

const configuredTopggWebhookAuth = String(process.env.TOPGG_WEBHOOK_AUTH || "").trim();
const explicitTopggWebhookV2Secret = String(process.env.TOPGG_WEBHOOK_V2_SECRET || process.env.TOPGG_WEBHOOK_SECRET || "").trim();
const topggWebhookV2Secret = explicitTopggWebhookV2Secret || (configuredTopggWebhookAuth.startsWith("whs_") ? configuredTopggWebhookAuth : "");
const topggWebhookAuth = topggWebhookV2Secret === configuredTopggWebhookAuth ? "" : configuredTopggWebhookAuth;
const parsedTopggPort = Number(process.env.TOPGG_WEBHOOK_PORT || process.env.PORT || 9596);
const topggPort = Number.isInteger(parsedTopggPort) && parsedTopggPort > 0 ? parsedTopggPort : 9596;
const topggHost = String(process.env.TOPGG_WEBHOOK_HOST || "0.0.0.0").trim() || "0.0.0.0";

if (topggWebhookAuth || topggWebhookV2Secret) {
    app.post("/topgg", async (req, res) => {
        try {
            const v2SignatureHeader = String(req.get("x-topgg-signature") || "").trim();
            const hasV2Signature = Boolean(v2SignatureHeader);

            if (hasV2Signature) {
                if (!topggWebhookV2Secret) {
                    console.warn("[TOPGG] Received V2 webhook but TOPGG_WEBHOOK_V2_SECRET is not configured.");
                    return res.status(503).json({ error: "Top.gg V2 webhook secret not configured" });
                }

                const verification = verifyTopggV2Signature(req, topggWebhookV2Secret);
                if (!verification.ok) {
                    console.warn(`[TOPGG] Rejected V2 webhook: ${verification.reason}`);
                    return res.status(401).json({ error: "Unauthorized" });
                }

                const eventType = String(req.body?.type || "").trim().toLowerCase();
                if (eventType === "webhook.test") {
                    console.log("[TOPGG] Received Webhooks V2 test event.");
                    return res.sendStatus(204);
                }

                if (eventType !== "vote.create") {
                    console.log(`[TOPGG] Ignored V2 webhook type: ${eventType || "unknown"}`);
                    return res.sendStatus(204);
                }

                const userId = req.body?.data?.user?.platform_id || req.body?.data?.user?.id || null;
                const now = parseTopggWebhookTime(req.body?.data?.created_at, Date.now());
                const expireAt = parseTopggWebhookTime(req.body?.data?.expires_at, now + (12 * 60 * 60 * 1000));
                const voteWeight = Math.max(1, Math.floor(Number(req.body?.data?.weight) || 1));

                await handleTopggVoteEvent(userId, {
                    now,
                    expireAt,
                    voteWeight,
                    source: "webhook_v2",
                });
                return res.sendStatus(204);
            }

            if (!topggWebhookAuth) {
                console.warn("[TOPGG] Received legacy webhook but TOPGG_WEBHOOK_AUTH is not configured.");
                return res.status(503).json({ error: "Top.gg legacy webhook auth not configured" });
            }

            const authHeader = String(req.get("authorization") || "").trim();
            if (authHeader !== topggWebhookAuth) {
                return res.status(403).json({ error: "Unauthorized" });
            }

            const vote = req.body || {};
            const voteType = String(vote?.type || "upvote").toLowerCase();
            if (voteType === "test") {
                console.log("[TOPGG] Received legacy webhook test event.");
                return res.sendStatus(204);
            }

            if (voteType !== "upvote") {
                console.log(`[TOPGG] Ignored legacy webhook type: ${voteType}`);
                return res.sendStatus(204);
            }

            await handleTopggVoteEvent(vote.user, {
                now: Date.now(),
                source: "webhook_legacy",
            });
            return res.sendStatus(204);
        } catch (err) {
            console.error("Top.gg webhook error:", err);
            return res.sendStatus(500);
        }
    });

    const topggServer = app.listen(topggPort, topggHost, () => {
        const modes = [
            topggWebhookAuth ? "legacy" : null,
            topggWebhookV2Secret ? "v2" : null,
        ].filter(Boolean).join(", ");
        console.log(`Top.gg webhook running on ${topggHost}:${topggPort} (POST /topgg, GET /topgg/health, modes: ${modes || "none"})`);
    });
    topggServer.on("error", (error) => {
        console.error("[TOPGG] Webhook server failed to start:", error);
    });
} else {
    console.warn("[WARN] TOPGG webhook secrets are not set. Vote webhook is disabled.");
}

function isKnownLavalinkNoise(error) {
  const message = String(error?.message || error || "");
  const stack = String(error?.stack || "");
  const fromLavalink = /lavalink-client[\\/].*index\.(js|mjs)/i.test(stack) || /Lavalink Node/i.test(message);

  if (!fromLavalink) return false;

  return /The operation was aborted due to timeout|does not provide any \/v4\/info|connect ETIMEDOUT|WebSocket is not open: readyState 0/i.test(message);
}

process.on('unhandledRejection', (error) => {
  if (isKnownLavalinkNoise(error)) return;

  try {
    if (client.logger && typeof client.logger.log === 'function') {
      client.logger.log(error, 'error');
    } else {
      console.error('[ERROR] Unhandled Rejection:', error);
    }
  } catch (e) {
    console.error('[FALLBACK ERROR]', error);
  }
  if (process.env.ERROR_WEBHOOK_URL || client.config.webhooks?.errorLogs) {
    const { logError } = require('./utils/errorHandler');
    logError(client, error, { source: 'Unhandled Rejection', skipLocalLog: true }).catch(() => {});
  }
});

process.on("uncaughtException", (err, origin) => {
  if (isKnownLavalinkNoise(err)) return;

  try {
    if (client.logger && typeof client.logger.log === 'function') {
      client.logger.log(err, 'error');
    } else {
      console.error('[ERROR] Uncaught Exception:', err);
    }
  } catch (e) {
    console.error('[FALLBACK ERROR]', err);
  }
  if (process.env.ERROR_WEBHOOK_URL || client.config.webhooks?.errorLogs) {
    const { logError } = require('./utils/errorHandler');
    logError(client, err, { source: 'Uncaught Exception', origin, skipLocalLog: true }).catch(() => {});
  }
});
