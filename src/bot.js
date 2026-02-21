require('dotenv').config();
const { Client, GatewayIntentBits, Partials, WebhookClient, EmbedBuilder, ActionRowBuilder, ButtonBuilder, Collection, ActivityType } = require("discord.js");
const { readdirSync } = require("fs");
const express = require("express");
const { Webhook } = require("@top-gg/sdk");
const Premium = require("./schema/Premium");
const db = require('../src/schema/prefix.js');
const { patchEmbedEmojiSanitizer } = require("./utils/embedEmojiSanitizer");

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
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember]
});

// Remove emojis from embed text globally while keeping button emojis intact.
patchEmbedEmojiSanitizer();

// Warn about privileged intents (enable in Developer Portal)
try {
    const intents = client.options.intents;
    if (intents && (intents.has && (intents.has(GatewayIntentBits.MessageContent) || intents.has(GatewayIntentBits.GuildMembers)))) {
        console.warn('[WARN] Bot requests privileged intents (Message Content / Guild Members). Enable them in the Developer Portal.');
    }
} catch (e) {}

const { AutoPoster } = require('topgg-autoposter')

module.exports = client;
client.commands = new Collection();
client.aliases = new Collection();
client.sls = new Collection();
client.config = require("../config.json");
client.owner = client.config.ownerId;
client.prefix = process.env.PREFIX || client.config.prefix;
client.embedColor = client.config.embedColor;
client.cooldowns = new Collection();
client.logger = require("./utils/logger.js");

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

const webhook = new Webhook(process.env.TOPGG_WEBHOOK_AUTH);

app.post("/topgg", webhook.listener(async (vote) => {
    try {
        console.log(`User ${vote.user} voted`);

        const expireTime = Date.now() + (12 * 60 * 60 * 1000); // 12 hours

        await Premium.findOneAndUpdate(
            { Id: vote.user, Type: "user" },
            {
                Id: vote.user,
                Type: "user",
                Permanent: false,
                Expire: expireTime
            },
            { upsert: true }
        );

        console.log(`12h premium granted to ${vote.user}`);

        // Optional DM
        const user = await client.users.fetch(vote.user).catch(() => null);
        if (user) {
            user.send("🎉 Thank you for voting! You received 12 hours of Premium access!").catch(() => {});
        }

    } catch (err) {
        console.error("Top.gg webhook error:", err);
    }
}));

app.listen(12952, () => {
    console.log("Top.gg webhook running on port 12952");
});
process.on('unhandledRejection', (error) => {
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