require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, ActivityType, Options } = require("discord.js");
const express = require("express");
const { Webhook } = require("@top-gg/sdk");
const User = require("./schema/User");
const { grantVotePremiumWindow } = require("./utils/premiumAccess");
const Logger = require("./services/Logger");

function normalizeUrl(value, fallback) {
    const text = String(value || "").trim();
    return text || fallback;
}

function trimTrailingSlash(value) {
    return String(value || "").replace(/\/+$/, "");
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
        presence: {
            status:'online',
            activities: [{
                name: `Music | =help`,
                type: ActivityType.Listening,
            }]
        },
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
client.owner = client.config.ownerIds || process.env.ownerid;
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
app.use(express.json());

const topggWebhookAuth = String(process.env.TOPGG_WEBHOOK_AUTH || "").trim();
const parsedTopggPort = Number(process.env.TOPGG_WEBHOOK_PORT || 12952);
const topggPort = Number.isInteger(parsedTopggPort) && parsedTopggPort > 0 ? parsedTopggPort : 12952;

if (topggWebhookAuth) {
    const webhook = new Webhook(topggWebhookAuth);

    app.post("/topgg", webhook.listener(async (vote) => {
        try {
            const voteType = String(vote?.type || "upvote").toLowerCase();
            if (voteType !== "upvote") {
                console.log(`[TOPGG] Ignored vote webhook type: ${voteType}`);
                return;
            }

            console.log(`User ${vote.user} voted`);

            const voteGrant = await grantVotePremiumWindow(vote.user, { now: Date.now() });

            await User.findOneAndUpdate(
                { userId: vote.user },
                {
                    $inc: { totalVotes: 1 },
                    $set: { voted: true },
                    $setOnInsert: { userId: vote.user }
                },
                { upsert: true, setDefaultsOnInsert: true }
            ).catch(() => {});

            if (voteGrant.status === "kept_permanent") {
                console.log(`[TOPGG] Vote recorded for ${vote.user}. Existing permanent premium kept.`);
            } else if (voteGrant.status === "extended" || voteGrant.status === "created") {
                console.log(`[TOPGG] Vote premium active for ${vote.user} until ${new Date(voteGrant.expire).toISOString()}`);
            } else {
                console.log(`[TOPGG] Vote recorded for ${vote.user}. Premium window unchanged.`);
            }

        } catch (err) {
            console.error("Top.gg webhook error:", err);
        }
    }));

    app.listen(topggPort, () => {
        console.log(`Top.gg webhook running on port ${topggPort}`);
    });
} else {
    console.warn("[WARN] TOPGG_WEBHOOK_AUTH is not set. Top.gg vote webhook is disabled.");
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
  if (client.config.webhooks?.errorLogs) {
    const { logError } = require('./utils/errorHandler');
    logError(client, error, { source: 'Unhandled Rejection' }).catch(() => {});
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
  if (client.config.webhooks?.errorLogs) {
    const { logError } = require('./utils/errorHandler');
    logError(client, err, { source: 'Uncaught Exception', origin }).catch(() => {});
  }
});
