const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";


function getEmoji(client, key, fallback = "") {
  return EMOJIS[key] || fallback;
}

const User = require("../../schema/User.js");
const blacklist = require("../../schema/blacklistSchema.js");
const db = require("../../schema/prefix.js");
const { resolvePremiumAccess } = require("../../utils/premiumAccess");
const { scheduleErrorMessageDeletion } = require("../../utils/errorMessageAutoDelete");

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_LAVALINK_COMMAND_WAIT_MS = toPositiveNumber(process.env.LAVALINK_COMMAND_WAIT_MS, 2500);
const PREFIX_CACHE_TTL_MS = toPositiveNumber(process.env.PREFIX_CACHE_TTL_MS, 5 * 60 * 1000);
const BLACKLIST_CACHE_TTL_MS = toPositiveNumber(process.env.BLACKLIST_CACHE_TTL_MS, 60 * 1000);

const EXPLICIT_LAVALINK_COMMAND_FILES = new Set([
  "src/commands/settings/247.js",
  "src/commands/settings/autoplay.js",
  "src/commands/settings/forcedestroy.js",
  "src/commands/settings/movebot.js",
  "src/commands/general/fix.js",
  "src/slashCommands/Settings/247.js",
  "src/slashCommands/Settings/autoplay.js",
  "src/slashCommands/Settings/forceplayerdestroy.js",
  "src/slashCommands/Settings/movebot.js",
  "src/slashCommands/General/fix.js",
]);

const EXPLICIT_LAVALINK_COMMAND_NAMES = new Set([
  "247",
  "addprevious",
  "autoplay",
  "disconnect",
  "fix",
  "forcedestroy",
  "forceplayerdestroy",
  "join",
  "movebot",
  "play",
  "playskip",
  "search",
]);

const prefixCache = new Map();
const blacklistCache = new Map();

function normalizeCommandFilename(command) {
  return String(command?._filename || "").replace(/\\/g, "/");
}

function commandNeedsUsableLavalink(command) {
  const filename = normalizeCommandFilename(command);
  const category = String(command?.category || "").toLowerCase();
  const name = String(command?.name || "").toLowerCase();

  if (
    filename.startsWith("src/commands/music/") ||
    filename.startsWith("src/commands/filters/") ||
    filename.startsWith("src/slashCommands/Music/") ||
    filename.startsWith("src/slashCommands/Filters/") ||
    filename.startsWith("src/slashCommands/Sources/")
  ) {
    return true;
  }

  if (EXPLICIT_LAVALINK_COMMAND_FILES.has(filename)) return true;
  if (category === "music" || category === "filters") return true;
  return EXPLICIT_LAVALINK_COMMAND_NAMES.has(name);
}

async function ensureUsableLavalinkNode(client, timeoutMs = DEFAULT_LAVALINK_COMMAND_WAIT_MS) {
  if (!client?.lavalink) {
    return {
      ok: false,
      embed: new EmbedBuilder()
        .setColor(client?.embedColor || EMBED_COLOR)
        .setDescription("Lavalink is not connected yet. Please try again in a moment."),
    };
  }

  if (client.lavalink.useable) return { ok: true };

  if (typeof client.waitForLavalinkReady === "function") {
    try {
      const ready = await client.waitForLavalinkReady(timeoutMs);
      if (ready) return { ok: true };
    } catch (_err) {}
  }

  if (client.lavalink.useable) return { ok: true };

  return {
    ok: false,
    embed: new EmbedBuilder()
      .setColor(client?.embedColor || EMBED_COLOR)
      .setDescription("No Lavalink node is available right now. Please try again in a moment."),
  };
}

function setTimedCache(cache, key, value, ttlMs, now = Date.now()) {
  if (cache.size >= 5000) {
    for (const [cachedKey, entry] of cache.entries()) {
      if (!entry || entry.expiresAt <= now) cache.delete(cachedKey);
      if (cache.size < 4500) break;
    }
  }

  cache.set(key, { value, expiresAt: now + ttlMs });
}

function getTimedCache(cache, key, now = Date.now()) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

async function getGuildPrefix(client, guildId) {
  const normalizedGuildId = String(guildId);
  const cachedPrefix = getTimedCache(prefixCache, normalizedGuildId);
  if (cachedPrefix !== null) return cachedPrefix;

  const fallbackPrefix = client.prefix;
  try {
    const data = await db.findOne({ Guild: normalizedGuildId }).lean().catch(() => null);
    const resolvedPrefix = data?.Prefix || fallbackPrefix;
    setTimedCache(prefixCache, normalizedGuildId, resolvedPrefix, PREFIX_CACHE_TTL_MS);
    return resolvedPrefix;
  } catch (err) {
    client.logger?.log?.(`Prefix lookup error: ${err?.message || err}`, "warn");
    setTimedCache(prefixCache, normalizedGuildId, fallbackPrefix, PREFIX_CACHE_TTL_MS);
    return fallbackPrefix;
  }
}

async function isUserBlacklisted(userId) {
  const normalizedUserId = String(userId);
  const cached = getTimedCache(blacklistCache, normalizedUserId);
  if (cached !== null) return cached;

  try {
    const blocked = Boolean(
      await blacklist.findOne({ UserID: normalizedUserId }).select("_id").lean().catch(() => null)
    );
    setTimedCache(blacklistCache, normalizedUserId, blocked, BLACKLIST_CACHE_TTL_MS);
    return blocked;
  } catch (_err) {
    return false;
  }
}

function createModernMessage(message, client) {
  const originalReply = message.reply.bind(message);
  const originalSend = message.channel.send.bind(message.channel);
  const originalChannel = message.channel;

  const wrappedChannel = new Proxy(originalChannel, {
    get(target, prop, receiver) {
      if (prop === "send") {
        return async payload => originalSend(payload);
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });

  return new Proxy(message, {
    get(target, prop, receiver) {
      if (prop === "reply") {
        return async payload => originalReply(payload);
      }
      if (prop === "channel") {
        return wrappedChannel;
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

module.exports = async (client, message) => {
  if (message?.author?.id === client?.user?.id) {
    scheduleErrorMessageDeletion(client, message);
  }

  if (!message.guild || !message.guild.id || message.author.bot) return;

  const owners = Array.isArray(client.config.ownerId)
    ? client.config.ownerId
    : [client.config.ownerId].filter(Boolean);

  const prefix = await getGuildPrefix(client, message.guild.id);

  const mention = new RegExp(`^<@!?${client.user.id}>( |)$`);
  if (message.content.match(mention)) {
    const botName = client.user?.username || "the bot";

    const embed = new EmbedBuilder()
      .setColor(client?.embedColor || EMBED_COLOR)
      .setAuthor({
        name: message.member.displayName,
        iconURL: message.member.displayAvatarURL({ forceStatic: false })
      })
      .setDescription([
        `Hey I am **${botName}** and my prefix is: \`${prefix}\``,
        `You can play music by joining a voice channel and running \`${prefix}play <song name>\`.`,
        `Run \`${prefix}help\` to view all of my commands.`
      ].join("\n"))
      .setFooter({ text: `${getEmoji(client, "support")} Need setup help? Open Support | Slash commands also work` });

    const support = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Support")
      .setURL("https://discord.gg/JQzBqgmwFm");

    const invite = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Invite me ")
      .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`);

       const vote = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("Vote me ")
        .setURL(`https://top.gg/bot/${client.user.id}/vote`);

    const supportEmoji = getEmoji(client, "support");
    const inviteEmoji = getEmoji(client, "invite");
    const voteEmoji = getEmoji(client, "vote");
    try { if (supportEmoji) support.setEmoji(supportEmoji); } catch (_e) {}
    try { if (inviteEmoji) invite.setEmoji(inviteEmoji); } catch (_e) {}
    try { if (voteEmoji) vote.setEmoji(voteEmoji); } catch (_e) {}
    const linkRow = new ActionRowBuilder().addComponents(support, invite, vote);

    return message.channel.send({
      embeds: [embed],
      components: [linkRow]
    });
  }

  const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mentionPrefix = new RegExp(`^(<@!?${client.user.id}>|${escapeRegex(prefix)})`);
  if (!mentionPrefix.test(message.content)) return;

  const matchedContent = message.content.match(mentionPrefix)[0];
  const args = message.content.slice(matchedContent.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();
  const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
  if (!command) return;

  // Fire-and-forget user usage tracking to avoid delaying command responses.
  User.findOneAndUpdate(
    { userId: message.author.id },
    { $inc: { count: 1 }, $setOnInsert: { userId: message.author.id } },
    { upsert: true, setDefaultsOnInsert: true }
  ).catch(() => {});

  if (command.owneronly && !owners.includes(message.author.id)) return;

  if (command.wl && !owners.includes(message.author.id)) {
    const blocked = await isUserBlacklisted(message.author.id);
    if (blocked) {
      const embed = new EmbedBuilder()
        .setColor(client?.embedColor || EMBED_COLOR)
        .setTitle(`${getEmoji(client, "error")} Access Blocked`)
        .setDescription("You are blacklisted from using this bot.");
      return message.channel.send({ embeds: [embed] });
    }
  }

  if (command.djonly) {
    const djSchema = require("../../schema/djroleSchema.js");
    try {
      const djData = await djSchema.findOne({ guildID: message.guild.id }).catch(() => null);
      if (djData?.Roleid) {
        if (!message.member.roles.cache.has(djData.Roleid)) {
          const embed = new EmbedBuilder()
            .setColor(client?.embedColor || EMBED_COLOR)
            .setTitle(`${getEmoji(client, "error")} DJ Role Required`)
            .setDescription("You need the configured DJ role to use this command.");
          return message.channel.send({ embeds: [embed] });
        }
      } else if (!owners.includes(message.author.id)) {
        const embed = new EmbedBuilder()
          .setColor(client?.embedColor || EMBED_COLOR)
          .setTitle(`${getEmoji(client, "error")} DJ Role Not Configured`)
          .setDescription("No DJ role is configured yet. Ask an admin to set one.");
        return message.channel.send({ embeds: [embed] });
      }
    } catch (err) {
      client.logger?.log(`DJ role check error: ${err.message}`, "error");
      const embed = new EmbedBuilder()
        .setColor(client?.embedColor || EMBED_COLOR)
        .setTitle(`${getEmoji(client, "error")} Permission Check Failed`)
        .setDescription("I couldn't verify DJ permissions. Please try again.");
      return message.channel.send({ embeds: [embed] });
    }
  }

  const requiresVoteOrPremium = Boolean(command.votelock || command.voteOnly || command.premium);
  if (requiresVoteOrPremium) {
    const { hasAccess } = await resolvePremiumAccess(message.author.id, message.guild.id, client);
    if (!hasAccess) {
      const isPremiumCommand = Boolean(command.premium);
      const embed = new EmbedBuilder()
        .setColor(client?.embedColor || EMBED_COLOR)
        .setTitle(`${getEmoji(client, "premium")} ${isPremiumCommand ? "Premium Required" : "Vote Required"}`)
        .setDescription(
          isPremiumCommand
            ? "This command requires Premium.\n\nVote on Top.gg to receive **12 hours Premium access**."
            : "You must vote on Top.gg to unlock this command for **12 hours**."
        );

      const support = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("Support")
        .setURL("https://discord.gg/JQzBqgmwFm");

      const invite = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("Invite")
        .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`);

      const vote = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("Vote")
        .setURL(`https://top.gg/bot/${client.user.id}/vote`);

      const supportEmoji = getEmoji(client, "support");
      const inviteEmoji = getEmoji(client, "invite");
      const voteEmoji = getEmoji(client, "vote");
      try { if (supportEmoji) support.setEmoji(supportEmoji); } catch (_e) {}
      try { if (inviteEmoji) invite.setEmoji(inviteEmoji); } catch (_e) {}
      try { if (voteEmoji) vote.setEmoji(voteEmoji); } catch (_e) {}
      const linkRow = new ActionRowBuilder().addComponents(support, invite, vote);

      return message.channel.send({
        embeds: [embed],
        components: [linkRow]
      });
    }
  }

  if (commandNeedsUsableLavalink(command)) {
    const lavalinkCheck = await ensureUsableLavalinkNode(client);
    if (!lavalinkCheck.ok) {
      return message.channel.send({ embeds: [lavalinkCheck.embed] }).catch(() => {});
    }
  }

  try {
    const modernMessage = createModernMessage(message, client);
    await command.execute(modernMessage, args, client, prefix);
  } catch (error) {
    client.logger?.log(`Command execution error: ${error?.message || error}`, "error");
    const embed = new EmbedBuilder()
      .setColor(client?.embedColor || EMBED_COLOR)
      .setTitle(`${getEmoji(client, "error")} Command Error`)
      .setDescription(`Error executing command: ${error?.message || "Unknown error"}`);
    await message.reply({ embeds: [embed] }).catch(() => {});
  }
};
