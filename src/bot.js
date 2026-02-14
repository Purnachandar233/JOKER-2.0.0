require('dotenv').config();
const { Client, GatewayIntentBits, Partials, WebhookClient, EmbedBuilder, ActionRowBuilder, ButtonBuilder, Collection, ActivityType } = require("discord.js");
const { readdirSync } = require("fs");

const Topgg = require("@top-gg/sdk")
const db = require('../src/schema/prefix.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    allowedMentions: { parse: ['users', 'roles'], repliedUser: true },
        presence: {
            status:'online',
            activities: [{
                name: `Music | =help`, 
                type: ActivityType.Listening,
            }]
        },
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember]
});

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
client.emoji = require("./utils/emoji.json");


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
