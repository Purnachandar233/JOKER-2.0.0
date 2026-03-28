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
const { buildAccessRequiredPrompt } = require("../../utils/accessPrompt");
const { handleMessageCommandError, logOwnerCommand } = require("../../utils/errorHandler");
const { scheduleErrorMessageDeletion } = require("../../utils/errorMessageAutoDelete");

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_LAVALINK_COMMAND_WAIT_MS = toPositiveNumber(process.env.LAVALINK_COMMAND_WAIT_MS, 2500);
const PREFIX_CACHE_TTL_MS = toPositiveNumber(process.env.PREFIX_CACHE_TTL_MS, 5 * 60 * 1000);
const BLACKLIST_CACHE_TTL_MS = toPositiveNumber(process.env.BLACKLIST_CACHE_TTL_MS, 60 * 1000);
const DJ_ROLE_CACHE_TTL_MS = toPositiveNumber(process.env.DJ_ROLE_CACHE_TTL_MS, 60 * 1000);
const HEAVY_MUSIC_COMMAND_COOLDOWN_MS = toPositiveNumber(process.env.HEAVY_MUSIC_COMMAND_COOLDOWN_MS, 2500);

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
const HEAVY_MUSIC_COMMAND_NAMES = new Set(["play", "search", "playskip", "addprevious"]);

const prefixCache = new Map();
const blacklistCache = new Map();
const djRoleCache = new Map();

function normalizeCommandFilename(command) {
  return String(command?._filename || "").replace(/\\/g, "/");
}

function commandNeedsUsableLavalink(command) {
  const filename = normalizeCommandFilename(command);
  const category = String(command?.category || "").toLowerCase();
  const name = String(command?.name || "").toLowerCase();

  if (name === "debugmusic") return false;

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

function formatCooldownDuration(remainingMs) {
  const remaining = Math.max(0, Number(remainingMs) || 0);
  if (remaining >= 1000) {
    return `${(remaining / 1000).toFixed(1)}s`;
  }
  return `${remaining}ms`;
}

function resolveCoreCommandCooldownMs(command) {
  const explicitCooldown = Number(command?.cooldownMs ?? command?.cooldown ?? 0);
  if (Number.isFinite(explicitCooldown) && explicitCooldown > 0) {
    return explicitCooldown;
  }

  const filename = normalizeCommandFilename(command);
  const name = String(command?.name || "").toLowerCase();

  if (filename.startsWith("src/slashCommands/Sources/")) {
    return HEAVY_MUSIC_COMMAND_COOLDOWN_MS;
  }

  if (HEAVY_MUSIC_COMMAND_NAMES.has(name)) {
    return HEAVY_MUSIC_COMMAND_COOLDOWN_MS;
  }

  return 0;
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

function normalizeDjRoleRecord(data) {
  if (!data || typeof data !== "object") return { hasConfig: false, roleId: null };
  const roleId = typeof data.Roleid === "string" && data.Roleid.trim() ? data.Roleid.trim() : null;
  return { hasConfig: Boolean(roleId), roleId };
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

async function getGuildDjRole(guildId) {
  const normalizedGuildId = String(guildId || "").trim();
  if (!normalizedGuildId) return { hasConfig: false, roleId: null };

  const cached = getTimedCache(djRoleCache, normalizedGuildId);
  if (cached !== null) return cached;

  const djSchema = require("../../schema/djroleSchema.js");
  const record = await djSchema.findOne({ guildID: normalizedGuildId }).lean().catch(() => null);
  const normalized = normalizeDjRoleRecord(record);
  setTimedCache(djRoleCache, normalizedGuildId, normalized, DJ_ROLE_CACHE_TTL_MS);
  return normalized;
}

module.exports = async (client, message) => {
  if (message?.author?.id === client?.user?.id) {
    scheduleErrorMessageDeletion(client, message);
  }

  if (!message.guild || !message.guild.id || message.author.bot) return;

  const owners = [String(process.env.OWNERID || "").trim()].filter(Boolean);

  const prefix = await getGuildPrefix(client, message.guild.id);

  const mention = new RegExp(`^<@!?${client.user.id}>( |)$`);
  if (message.content.match(mention)) {
    const botName = client.user?.username || "the bot";
    const legal = client?.legalLinks || {};

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
      .setURL(legal.supportServerUrl);

    const invite = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Invite me ")
      .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`);

       const vote = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("Vote me ")
        .setURL(`https://top.gg/bot/${client.user.id}/vote`);

    const privacy = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Privacy")
      .setURL(legal.privacyPolicyUrl);

    const terms = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Terms")
      .setURL(legal.termsOfServiceUrl);

    const supportEmoji = getEmoji(client, "support");
    const inviteEmoji = getEmoji(client, "invite");
    const voteEmoji = getEmoji(client, "vote");
    try { if (supportEmoji) support.setEmoji(supportEmoji); } catch (_e) {}
    try { if (inviteEmoji) invite.setEmoji(inviteEmoji); } catch (_e) {}
    try { if (voteEmoji) vote.setEmoji(voteEmoji); } catch (_e) {}
    const linkRow = new ActionRowBuilder().addComponents(support, invite, vote);
    const legalRow = new ActionRowBuilder().addComponents(privacy, terms);

    return message.channel.send({
      embeds: [embed],
      components: [linkRow, legalRow]
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
    try {
      const djData = await getGuildDjRole(message.guild.id);
      if (djData.hasConfig) {
        const hasDjRole = message.member.roles.cache.has(djData.roleId);
        const hasManagerBypass = Boolean(
          message.member.permissions?.has?.("ManageGuild") ||
          message.member.permissions?.has?.("Administrator")
        );

        if (!hasDjRole && !hasManagerBypass && !owners.includes(message.author.id)) {
          const embed = new EmbedBuilder()
            .setColor(client?.embedColor || EMBED_COLOR)
            .setAuthor({ name: ` DJ Role Required!`, iconURL: message.member.displayAvatarURL({ forceStatic: false }) })
            .setDescription("You need the configured DJ role or Manage Server permission to use this command.");
          return message.channel.send({ embeds: [embed] });
        }
      }
    } catch (err) {
      client.logger?.log(`DJ role check error: ${err.message}`, "error");
      const embed = new EmbedBuilder()
        .setColor(client?.embedColor || EMBED_COLOR)
        .setAuthor({ name: `Permission Check Failed!`, iconURL: message.member.displayAvatarURL({ forceStatic: false }) })
        .setDescription("I couldn't verify DJ permissions. Please try again.");
      return message.channel.send({ embeds: [embed] });
    }
  }

  const requiresVoteOrPremium = Boolean(command.votelock || command.voteOnly || command.premium);
  if (requiresVoteOrPremium) {
    const { hasAccess } = await resolvePremiumAccess(message.author.id, message.guild.id, client);
    if (!hasAccess) {
      const prompt = buildAccessRequiredPrompt({
        client,
        commandLabel: `${prefix}${command.name || "command"}`,
        isPremiumCommand: Boolean(command.premium),
        avatarURL:
          message.member?.displayAvatarURL?.({ forceStatic: false }) ||
          message.author?.displayAvatarURL?.({ forceStatic: false }) ||
          null,
        getEmoji: (key, fallback = "") => getEmoji(client, key, fallback),
      });
      const payload = {
        embeds: [prompt.embed],
      };

      if (prompt.components.length) {
        payload.components = prompt.components;
      }

      return message.channel.send(payload);
      /*

      const isPremiumCommand = Boolean(command.premium);
      const legal = client?.legalLinks || {};

      const embed = new EmbedBuilder()
        .setColor(client?.embedColor || EMBED_COLOR)
        .setAuthor({ name: `${isPremiumCommand ? "Premium Required" : "Vote Required"}` ,iconURL: message.member.displayAvatarURL({ forceStatic: false }) })
        .setDescription(
          isPremiumCommand
            ?`Oops! **${command.name}** is a [Premium](https://top.gg/bot/${client.user.id}/vote) command because it uses more resources than any other command.
You can use this command by voting on [Top.gg](https://top.gg/bot/${client.user.id}/vote) — not only will you unlock this command **Unlocks all premium features**.`
            : `Oops! **${command.name}** Sis a [Premium](https://top.gg/bot/${client.user.id}/vote) command. You must vote on [Top.gg](https://top.gg/bot/${client.user.id}/vote) to unlock this command for **12 hours**.`
        );
     
      const vote = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("premium")
        .setURL(`https://top.gg/bot/${client.user.id}/vote`);

      const voteEmoji = getEmoji(client, "vote");
      try { if (voteEmoji) vote.setEmoji(star); } catch (_e) {}
      const linkRow = new ActionRowBuilder().addComponents(vote);
      

      return message.channel.send({
        embeds: [embed],
        components: [linkRow]
      });
      */
    }
  }

  if (commandNeedsUsableLavalink(command)) {
    const lavalinkCheck = await ensureUsableLavalinkNode(client);
    if (!lavalinkCheck.ok) {
      return message.channel.send({ embeds: [lavalinkCheck.embed] }).catch(() => {});
    }
  }

  if (!owners.includes(message.author.id) && client.cooldownManager) {
    const cooldownMs = resolveCoreCommandCooldownMs(command);
    if (cooldownMs > 0) {
      const cooldownKey = `core_prefix:${String(command?.name || commandName || "command").toLowerCase()}`;
      const cooldown = client.cooldownManager.check(cooldownKey, message.author.id);
      if (cooldown.onCooldown) {
        const embed = new EmbedBuilder()
          .setColor(client?.embedColor || EMBED_COLOR)
          .setTitle(`${getEmoji(client, "time")} Cooldown Active`)
          .setDescription(`This command is cooling down. Try again in ${formatCooldownDuration(cooldown.remaining)}.`);
        return message.channel.send({ embeds: [embed] }).catch(() => {});
      }
      client.cooldownManager.set(cooldownKey, message.author.id, cooldownMs);
    }
  }

  try {
    if (command.owneronly) {
      logOwnerCommand(client, {
        command: `${prefix}${command.name || commandName || "command"}`,
        mode: "prefix",
      }).catch(() => {});
    }

    await command.execute(message, args, client, prefix);
    User.applyProgressMilestones(message.author.id, {
      incrementCommands: 1,
    }).catch(() => {});
  } catch (error) {
    await handleMessageCommandError(client, message, error, {
      source: "PrefixCommand",
      mode: "prefix",
      command: command.name || commandName || "command",
      commandLabel: `${prefix}${command.name || commandName || "command"}`,
    });
  }
};


