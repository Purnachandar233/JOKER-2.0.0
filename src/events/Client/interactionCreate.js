const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionType } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";

const blacklist = require("../../schema/blacklistSchema.js");
const { resolvePremiumAccess } = require("../../utils/premiumAccess");
const { buildAccessRequiredPrompt } = require("../../utils/accessPrompt");
const { handleInteractionCommandError, logOwnerCommand } = require("../../utils/errorHandler");
const { safeReply, safeDeferReply } = require("../../utils/interactionResponder");
const welcomeSchema = require("../../schema/welcome.js");
const { buildWelcomeSetupPanel } = require("../../welcome/panel.js");
const {
  DEFAULT_WELCOME_EMBED_MESSAGE,
  DEFAULT_WELCOME_TEXT_MESSAGE,
  DEFAULT_WELCOME_TITLE,
  normalizeWelcomeColor,
  renderWelcomeTemplate,
} = require("../../welcome/template.js");
const { ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");

const MUSIC_COMPONENT_IDS = new Set(["prevtrack", "prtrack", "skiptrack", "shufflequeue", "looptrack", "showqueue", "stop"]);
const PREMIUM_COMPONENT_IDS = new Set(["premium_dashboard_activate", "premium_dashboard_deactivate"]);
const EPHEMERAL_FLAG = 1 << 6;

async function refreshWelcomePanel(interaction, successMessage = null) {
  try {
    const data = await welcomeSchema.findOne({ guildID: interaction.guild.id }).catch(() => null);
    const components = buildWelcomeSetupPanel({
      data,
      guild: interaction.guild,
      embedColor: EMBED_COLOR,
      slash: true,
      statusMessage: successMessage
        ? `${successMessage} <@${interaction.user.id}>.`
        : null,
    });

    if (!interaction.replied && !interaction.deferred) {
      await interaction.update({ components });
      return;
    }

    if (typeof interaction.message?.edit === "function") {
      await interaction.message.edit({ components });
      return;
    }

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ components }).catch(() => null);
    }
  } catch (err) {
    // Expected states: already acknowledged or unknown interaction after delayed or re-used component.
    if (/already been acknowledged|already been sent or deferred|unknown interaction/i.test(err?.message || "")) {
      return;
    }
    console.error("Error refreshing welcome panel:", err.message);
    throw err;
  }
}

async function syncWelcomePanelMessage(interaction, successMessage = null) {
  try {
    if (typeof interaction.message?.edit !== "function" || !interaction.guild?.id) return;

    const data = await welcomeSchema.findOne({ guildID: interaction.guild.id }).catch(() => null);
    const components = buildWelcomeSetupPanel({
      data,
      guild: interaction.guild,
      embedColor: EMBED_COLOR,
      slash: true,
      statusMessage: successMessage
        ? `${successMessage} <@${interaction.user.id}>.`
        : null,
    });

    await interaction.message.edit({ components }).catch(() => null);
  } catch (_err) {}
}

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const DEFAULT_LAVALINK_COMMAND_WAIT_MS = toPositiveNumber(process.env.LAVALINK_COMMAND_WAIT_MS, 2500);
const BLACKLIST_CACHE_TTL_MS = toPositiveNumber(process.env.BLACKLIST_CACHE_TTL_MS, 60 * 1000);
const DJ_ROLE_CACHE_TTL_MS = toPositiveNumber(process.env.DJ_ROLE_CACHE_TTL_MS, 60 * 1000);
const HEAVY_MUSIC_COMMAND_COOLDOWN_MS = toPositiveNumber(process.env.HEAVY_MUSIC_COMMAND_COOLDOWN_MS, 2500);
const MUSIC_COMPONENT_COOLDOWN_MS = toPositiveNumber(process.env.MUSIC_COMPONENT_COOLDOWN_MS, 900);
const blacklistCache = new Map();
const djRoleCache = new Map();
const HEAVY_MUSIC_COMMAND_NAMES = new Set(["play", "search", "playskip", "addprevious"]);
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

function getEmoji(client, key, fallback = "") {
  return EMOJIS[key] || fallback;
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

async function isUserBlacklisted(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return false;

  const cached = getTimedCache(blacklistCache, normalizedUserId);
  if (cached !== null) return cached;

  const blocked = Boolean(
    await blacklist.findOne({ UserID: normalizedUserId }).select("_id").lean().catch(() => null)
  );
  setTimedCache(blacklistCache, normalizedUserId, blocked, BLACKLIST_CACHE_TTL_MS);
  return blocked;
}

async function getGuildDjRole(guildId) {
  const normalizedGuildId = String(guildId || "").trim();
  if (!normalizedGuildId) return { hasConfig: false, roleId: null };

  const cached = getTimedCache(djRoleCache, normalizedGuildId);
  if (cached !== null) return cached;

  const djSchema = require("../../schema/djroleSchema");
  const record = await djSchema.findOne({ guildID: normalizedGuildId }).lean().catch(() => null);
  const normalized = normalizeDjRoleRecord(record);
  setTimedCache(djRoleCache, normalizedGuildId, normalized, DJ_ROLE_CACHE_TTL_MS);
  return normalized;
}

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

async function ensureUsableLavalinkNode(client, { timeoutMs = DEFAULT_LAVALINK_COMMAND_WAIT_MS } = {}) {
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

function normalizeInteractionOptions(options, { forEdit = false } = {}) {
  if (!options || typeof options !== "object") return options;

  const cloned = { ...options };
  if (Object.prototype.hasOwnProperty.call(cloned, "ephemeral")) {
    const ephemeral = Boolean(cloned.ephemeral);
    delete cloned.ephemeral;

    if (!forEdit && ephemeral) {
      if (typeof cloned.flags === "number") cloned.flags |= EPHEMERAL_FLAG;
      else cloned.flags = EPHEMERAL_FLAG;
    }
  }

  return cloned;
}

function hasWelcomeManagePermission(interaction) {
  const permissions = interaction?.memberPermissions || interaction?.member?.permissions;
  if (!permissions || typeof permissions.has !== "function") return false;
  return permissions.has("ManageGuild") || permissions.has("Administrator");
}

function patchSafeInteractionResponses(interaction) {
  if (interaction.__safeResponsePatched) return;

  const originalDeferReply = typeof interaction.deferReply === "function"
    ? interaction.deferReply.bind(interaction)
    : null;
  const originalReply = typeof interaction.reply === "function"
    ? interaction.reply.bind(interaction)
    : null;
  const originalEditReply = typeof interaction.editReply === "function"
    ? interaction.editReply.bind(interaction)
    : null;
  const originalFollowUp = typeof interaction.followUp === "function"
    ? interaction.followUp.bind(interaction)
    : null;

  if (originalDeferReply) {
    interaction.deferReply = async (options = {}) => {
      if (interaction.deferred || interaction.replied) return interaction;
      try {
        return await originalDeferReply(normalizeInteractionOptions(options));
      } catch (error) {
        if (
          error?.code === 40060 ||
          /already been acknowledged/i.test(error?.message || "")
        ) {
          return interaction;
        }
        throw error;
      }
    };
  }

  if (originalReply && originalEditReply && originalFollowUp) {
    interaction.reply = async (options = {}) => {
      try {
        if (interaction.replied) return await originalFollowUp(normalizeInteractionOptions(options));
        if (interaction.deferred) return await originalEditReply(normalizeInteractionOptions(options, { forEdit: true }));
        return await originalReply(normalizeInteractionOptions(options));
      } catch (error) {
        if (
          error?.code === 40060 ||
          /already been acknowledged/i.test(error?.message || "")
        ) {
          if (interaction.deferred) return originalEditReply(normalizeInteractionOptions(options, { forEdit: true })).catch(() => null);
          return originalFollowUp(normalizeInteractionOptions(options)).catch(() => null);
        }
        throw error;
      }
    };

    interaction.editReply = async (options = {}) => {
      if (interaction.deferred || interaction.replied) {
        return originalEditReply(normalizeInteractionOptions(options, { forEdit: true }));
      }
      return originalReply(normalizeInteractionOptions(options));
    };

    interaction.followUp = async (options = {}) => {
      if (interaction.deferred || interaction.replied) {
        return originalFollowUp(normalizeInteractionOptions(options));
      }
      return originalReply(normalizeInteractionOptions(options));
    };
  }

  interaction.__safeResponsePatched = true;
}

async function runSlashCommand(client, interaction, ownerIds) {
  const slashCommand = client.sls.get(interaction.commandName);
  if (!slashCommand) return;

  patchSafeInteractionResponses(interaction);

  if (slashCommand.djonly) {
    if (!interaction.guild?.id) {
      const embed = new EmbedBuilder()
        .setColor(client?.embedColor || EMBED_COLOR)
        .setTitle(`${getEmoji(client, "error")} Server Only`)
        .setDescription("This command can only be used inside a server.");
      return interaction.editReply({ embeds: [embed] }).catch(() => {});
    }

    try {
      const djData = await getGuildDjRole(interaction.guild.id);
      if (djData.hasConfig) {
        if (!interaction.member?.roles?.cache?.has(djData.roleId)) {
          const embed = new EmbedBuilder()
            .setColor(client?.embedColor || EMBED_COLOR)
            .setTitle(`${getEmoji(client, "error")} DJ Role Required`)
            .setDescription(`<@${interaction.member.id}> You need the configured DJ role to use this command.`);
          return interaction.editReply({ embeds: [embed] }).catch(() => {});
        }
      } else if (!ownerIds.includes(interaction.user.id)) {
        const embed = new EmbedBuilder()
          .setColor(client?.embedColor || EMBED_COLOR)
          .setTitle(`${getEmoji(client, "error")} DJ Role Not Configured`)
          .setDescription(`<@${interaction.member.id}> No DJ role is configured yet. Contact a server admin.`);
        return interaction.editReply({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      client.logger?.log?.(`DJ role check error: ${err?.message || err}`, "error");
      const embed = new EmbedBuilder()
        .setColor(client?.embedColor || EMBED_COLOR)
        .setTitle(`${getEmoji(client, "error")} Permission Check Failed`)
        .setDescription("I couldn't verify DJ permissions. Please try again.");
      return interaction.editReply({ embeds: [embed] }).catch(() => {});
    }
  }

  if (slashCommand.wl) {
    const blocked = await isUserBlacklisted(interaction.user?.id);
    if (blocked && !ownerIds.includes(interaction.user?.id)) {
      const embed = new EmbedBuilder()
        .setColor(client?.embedColor || EMBED_COLOR)
        .setTitle(`${getEmoji(client, "error")} Access Blocked`)
        .setDescription(`<@${interaction.member.id}> You are blacklisted from using the bot.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => {});
    }
  }

  if (slashCommand.owneronly && !ownerIds.includes(interaction.user.id)) {
    const embed = new EmbedBuilder()
      .setColor(client?.embedColor || EMBED_COLOR)
      .setTitle(`${getEmoji(client, "error")} Owner Only`)
      .setDescription("This command is restricted to the bot owner.");
    return interaction.editReply({ embeds: [embed] }).catch(() => {});
  }

  if (slashCommand.owneronly) {
    logOwnerCommand(client, {
      command: `/${slashCommand.name || interaction.commandName || "command"}`,
      mode: "slash",
    }).catch(() => {});
  }

  // Premium / Vote Lock Check
  if (slashCommand.votelock || slashCommand.voteOnly || slashCommand.premium) {
    const { hasAccess } = await resolvePremiumAccess(interaction.user.id, interaction.guild?.id, client);

    if (!hasAccess) {
      const prompt = buildAccessRequiredPrompt({
        client,
        commandLabel: `/${slashCommand.name || interaction.commandName || "command"}`,
        isPremiumCommand: Boolean(slashCommand.premium),
        avatarURL: interaction.user?.displayAvatarURL?.({ forceStatic: false }) || null,
        getEmoji: (key, fallback = "") => getEmoji(client, key, fallback),
      });
      const payload = {
        embeds: [prompt.embed],
        ephemeral: true,
      };

      if (prompt.components.length) {
        payload.components = prompt.components;
      }

      return interaction.reply(payload).catch(() => {});
      /*
      const embed = new EmbedBuilder()
         .setColor(client?.embedColor || EMBED_COLOR)
        .setAuthor({ name: `${isPremiumCommand ? "Premium Required" : "Vote Required"}` ,iconURL: message.member.displayAvatarURL({ forceStatic: false }) })
        .setDescription(
          isPremiumCommand
            ?`Oops! **${command.name}** is a [Premium](https://top.gg/bot/${client.user.id}/vote) command because it uses more resources than any other command.
You can use this command by voting on [Top.gg](https://top.gg/bot/${client.user.id}/vote) — not only will you unlock this command **Unlocks all premium features**.`
            : `Oops! **${command.name}**is a [Premium](https://top.gg/bot/${client.user.id}/vote) command. You must vote on [Top.gg](https://top.gg/bot/${client.user.id}/vote) to unlock this command for **12 hours**.`
        );

      const support = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("Support")
        .setURL(legal.supportServerUrl);

      const invite = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("Invite")
        .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`);

      const vote = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("Vote")
        .setURL(`https://top.gg/bot/${client.user.id}/vote`);

      const voteEmoji = getEmoji(client, "vote");
      try { if (voteEmoji) vote.setEmoji(voteEmoji); } catch (_e) {}
      const linkRow = new ActionRowBuilder().addComponents(vote);
      

      return interaction.reply({
        embeds: [embed],
        components: [linkRow, legalRow],
        ephemeral: true
      }).catch(() => {});
      */
    }
  }

  if (commandNeedsUsableLavalink(slashCommand)) {
    const lavalinkCheck = await ensureUsableLavalinkNode(client);
    if (!lavalinkCheck.ok) {
      return interaction.reply({
        embeds: [lavalinkCheck.embed],
        ephemeral: true
      }).catch(() => {});
    }
  }

  if (!ownerIds.includes(interaction.user.id) && client.cooldownManager) {
    const cooldownMs = resolveCoreCommandCooldownMs(slashCommand);
    if (cooldownMs > 0) {
      const cooldownKey = `core_slash:${String(slashCommand?.name || interaction.commandName || "command").toLowerCase()}`;
      const cooldown = client.cooldownManager.check(cooldownKey, interaction.user.id);
      if (cooldown.onCooldown) {
        const embed = new EmbedBuilder()
          .setColor(client?.embedColor || EMBED_COLOR)
          .setTitle(`${getEmoji(client, "time")} Cooldown Active`)
          .setDescription(`This command is cooling down. Try again in ${formatCooldownDuration(cooldown.remaining)}.`);
        return safeReply(interaction, { embeds: [embed], ephemeral: true });
      }
      client.cooldownManager.set(cooldownKey, interaction.user.id, cooldownMs);
    }
  }

  try {
    await slashCommand.run(client, interaction);
  } catch (error) {
    await handleInteractionCommandError(client, interaction, error, {
      source: "SlashCommand",
      mode: "slash",
      command: interaction.commandName,
      commandLabel: `/${slashCommand.name || interaction.commandName || "command"}`,
    });
  }
}

async function runMusicComponent(client, interaction) {
  patchSafeInteractionResponses(interaction);

  const ok = EMOJIS.ok;
  const no = EMOJIS.no;
  const normalizedCustomId = interaction.customId.startsWith("music_")
    ? interaction.customId.slice(6)
    : interaction.customId;

  if (!MUSIC_COMPONENT_IDS.has(normalizedCustomId)) return;
  if (!interaction.guild) return;

  try {
    await safeDeferReply(interaction, { ephemeral: true });
  } catch (err) {
    client.logger?.log?.(`Defer error: ${err?.message}`, "warn");
  }

  const player = client.lavalink?.players?.get(interaction.guild.id);
  if (!player) {
    await interaction.editReply({ content: `${no} No active player found.` }).catch(() => {});
    return;
  }

  const { channel } = interaction.member.voice;
  if (!channel) {
    await interaction.editReply({ content: `${no} You must be in a voice channel.` }).catch(() => {});
    return;
  }
  if (channel.id !== player.voiceChannelId) {
    await interaction.editReply({ content: `${no} You must be in the same voice channel as me.` }).catch(() => {});
    return;
  }
  if (interaction.member.voice.selfDeaf) {
    await interaction.editReply({ content: `${no} You cannot use this while deafened.` }).catch(() => {});
    return;
  }

  if (normalizedCustomId !== "showqueue") {
    const lavalinkCheck = await ensureUsableLavalinkNode(client, { timeoutMs: 750 });
    if (!lavalinkCheck.ok) {
      await interaction.editReply({ embeds: [lavalinkCheck.embed] }).catch(() => {});
      return;
    }
  }

  if (client.cooldownManager && MUSIC_COMPONENT_COOLDOWN_MS > 0) {
    const componentCooldownKey = `music_component:${normalizedCustomId}`;
    const cooldown = client.cooldownManager.check(componentCooldownKey, interaction.user.id);
    if (cooldown.onCooldown) {
      await interaction.editReply({
        content: `${no} Slow down a little. Try again in ${formatCooldownDuration(cooldown.remaining)}.`
      }).catch(() => {});
      return;
    }
    client.cooldownManager.set(componentCooldownKey, interaction.user.id, MUSIC_COMPONENT_COOLDOWN_MS);
  }

  switch (normalizedCustomId) {
    case "prevtrack": {
      try {
        const previousTrack = Array.isArray(player.queue?.previous) && player.queue.previous.length
          ? player.queue.previous[0]
          : null;

        if (!previousTrack) {
          await interaction.editReply({ content: `${no} No previous track is available yet.` }).catch(() => {});
          return;
        }

        if (!Array.isArray(player.queue?.tracks)) {
          player.queue.tracks = [];
        }

        const currentTrack = player.queue?.current || null;
        if (currentTrack) {
          player.queue.tracks.unshift(currentTrack);
        }
        player.queue.tracks.unshift(previousTrack);

        await player.skip();
        await interaction.editReply({ content: `${ok} Returned to the previous track.` }).catch(() => {});
      } catch (error) {
        client.logger?.log(`Previous track button error: ${error?.message || error}`, "error");
        await interaction.editReply({ content: `${no} Failed to go back to the previous track.` }).catch(() => {});
      }
      break;
    }

    case "prtrack": {
      try {
        const isPaused = Boolean(player.paused);
        if (!isPaused) {
          await player.pause();
        } else {
          await player.resume();
        }

        const finalPaused = Boolean(player.paused);
        if (isPaused !== finalPaused) {
          await interaction.editReply({
            content: finalPaused ? `${ok} Paused the player.` : `${ok} Resumed the player.`
          }).catch(() => {});
        } else {
          await interaction.editReply({
            content: `${no} Requested toggle sent but player state has not changed yet.`
          }).catch(() => {});
        }
      } catch (err) {
        client.logger?.log(`Pause/Resume error: ${err?.stack || err}`, "error");
        await interaction.editReply({ content: `${no} Failed to toggle pause.` }).catch(() => {});
      }
      break;
    }

    case "shufflequeue": {
      try {
        if (!Array.isArray(player.queue?.tracks) || player.queue.tracks.length <= 1) {
          await interaction.editReply({ content: `${no} Not enough tracks to shuffle.` }).catch(() => {});
          return;
        }

        await player.queue.shuffle();
        await interaction.editReply({ content: `${ok} The queue has been shuffled.` }).catch(() => {});
      } catch (error) {
        client.logger?.log(`Shuffle button error: ${error?.message || error}`, "error");
        await interaction.editReply({ content: `${no} Failed to shuffle the queue.` }).catch(() => {});
      }
      break;
    }

    case "skiptrack": {
      try {
        const queue = [
          player?.queue?.current,
          ...(Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [])
        ].filter(Boolean);
        const reportedSize = queue.length;
        const upcomingCount = Math.max(
          0,
          queue.length > 0 ? queue.length - 1 : 0,
          reportedSize > 0 ? reportedSize - 1 : 0
        );

        if (upcomingCount > 0) {
          try {
            await player.skip();
          } catch (_err) {
            await player.skip().catch(() => {});
          }
          await interaction.editReply({ content: `${ok} Skipped to the next track.` }).catch(() => {});
          return;
        }

        const twentyfourseven = require("../../schema/twentyfourseven.js");
        const is247Enabled = await twentyfourseven.findOne({ guildID: interaction.guild.id });
        if (is247Enabled) {
          await interaction.editReply({ content: `${no} No songs in queue, add more to skip.` }).catch(() => {});
          return;
        }

        await interaction.editReply({ content: `${no} There are no more tracks to skip.` }).catch(() => {});
      } catch (error) {
        client.logger?.log(`Skip error: ${error?.message || error}`, "error");
        await interaction.editReply({ content: `${no} Failed to skip track.` }).catch(() => {});
      }
      break;
    }

    case "looptrack": {
      try {
        const currentMode = player.repeatMode || "off";
        if (currentMode === "track") {
          await player.setRepeatMode("off");
          await interaction.editReply({ content: `${ok} Loop disabled.` }).catch(() => {});
        } else {
          await player.setRepeatMode("track");
          await interaction.editReply({ content: `${ok} Looping current track.` }).catch(() => {});
        }
      } catch (error) {
        client.logger?.log(`Loop toggle error: ${error?.message || error}`, "error");
        await interaction.editReply({ content: `${no} Failed to toggle loop.` }).catch(() => {});
      }
      break;
    }

    case "showqueue": {
      try {
        const queueCommand = client.commands?.get?.("queue");
        if (!queueCommand || typeof queueCommand.execute !== "function") {
          await interaction.editReply({ content: `${no} Queue command is unavailable right now.` }).catch(() => {});
          return;
        }

        const proxyMessage = {
          author: interaction.user,
          member: interaction.member,
          guild: interaction.guild,
          channel: interaction.channel,
          client,
        };

        await queueCommand.execute(proxyMessage, [], client);
        await interaction.editReply({ content: `${ok} Opened queue panel in this channel.` }).catch(() => {});
      } catch (error) {
        client.logger?.log(`Queue button panel error: ${error?.message || error}`, "error");
        await interaction.editReply({ content: `${no} Failed to open queue panel.` }).catch(() => {});
      }
      break;
    }

    case "stop": {
      try {
        const autoplay = player.get("autoplay");
        if (autoplay === true) {
          player.set("autoplay", false);
        }

        player.set("stopped", true);
        try {
          await player.stopPlaying(true, false);
        } catch (err) {
          client.logger?.log(`Stop action error: ${err?.stack || err}`, "error");
          await player.destroy().catch(() => {});
        }

        if (typeof player.queue?.clear === "function") {
          await player.queue.clear().catch(() => {});
        } else if (Array.isArray(player.queue?.tracks) && typeof player.queue.splice === "function") {
          await player.queue.splice(0, player.queue.tracks.length).catch(() => {});
        } else if (Array.isArray(player.queue?.tracks)) {
          player.queue.tracks.length = 0;
        }
        await interaction.editReply({ content: `${ok} Stopped the player and cleared the queue.` }).catch(() => {});
      } catch (error) {
        client.logger?.log(`Stop error: ${error?.message || error}`, "error");
        await interaction.editReply({ content: `${no} Failed to stop the player.` }).catch(() => {});
      }
      break;
    }

    default:
      break;
  }
}

async function runPremiumComponent(client, interaction) {
  patchSafeInteractionResponses(interaction);

  if (!PREMIUM_COMPONENT_IDS.has(interaction.customId)) return false;

  const embedColor = client?.embedColor || EMBED_COLOR;
  const support = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Support")
    .setURL(client?.legalLinks?.supportServerUrl || "https://discord.gg/JQzBqgmwFm");

  const vote = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Vote")
    .setURL(`https://top.gg/bot/${client.user.id}/vote`);

  try {
    const supportEmoji = getEmoji(client, "support");
    if (supportEmoji) support.setEmoji(supportEmoji);
  } catch (_e) {}

  try {
    const voteEmoji = getEmoji(client, "vote");
    if (voteEmoji) vote.setEmoji(voteEmoji);
  } catch (_e) {}

  const linkRow = new ActionRowBuilder().addComponents(vote, support);

  try {
    await safeDeferReply(interaction, { ephemeral: true });
  } catch (_err) {}

  let access = {
    userPremium: false,
    guildPremium: false,
    hasAccess: false,
  };

  try {
    access = await resolvePremiumAccess(interaction.user.id, interaction.guild?.id, client);
  } catch (_err) {}

  if (interaction.customId === "premium_dashboard_activate") {
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji(client, "premium")} Activate Premium`)
      .setDescription(
        access.hasAccess
          ? "Premium is already active for your effective access scope.\nYou can still vote to extend premium."
          : "Vote on Top.gg for temporary premium access, or review the support, privacy, and terms links for premium access information."
      );

    await interaction.editReply({ embeds: [embed], components: [linkRow] }).catch(() => {});
    return true;
  }

  if (interaction.customId === "premium_dashboard_deactivate") {
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji(client, "warn")} Deactivate Premium`)
      .setDescription(
        access.hasAccess
          ? "Automatic deactivation is intentionally disabled to prevent accidental premium loss.\nOpen support and we will guide safe changes."
          : "No active premium access is currently detected, so there is nothing to deactivate."
      );

    await interaction.editReply({ embeds: [embed], components: [linkRow] }).catch(() => {});
    return true;
  }

  return false;
}

async function handleWelcomeModalSubmit(interaction) {
  const modalId = interaction.customId;
  if (
    modalId !== "welcome_message_modal" &&
    modalId !== "welcome_text_message_modal" &&
    modalId !== "welcome_title_modal" &&
    modalId !== "welcome_color_modal"
  ) {
    return false;
  }

  try {
    if (!hasWelcomeManagePermission(interaction)) {
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setDescription("*You need `Manage Server` or `Administrator` permission.*");
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      return true;
    }

    const embedColor = EMBED_COLOR;
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const ok = EMOJIS.ok;
    const no = EMOJIS.no;

    if (modalId === "welcome_message_modal") {
      const messageText = interaction.fields.getTextInputValue("message_input");
      await welcomeSchema.findOneAndUpdate(
        { guildID: interaction.guild.id },
        { message: messageText },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      await syncWelcomePanelMessage(interaction, "Embed message updated by");

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Message Updated`)
        .setDescription(`${ok} Welcome message template updated by ${interaction.user}.`)
        .addFields({ name: `${getEmoji("info")} New Message`, value: `\`${messageText}\`` });
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      return true;
    }

    if (modalId === "welcome_text_message_modal") {
      const textMessage = interaction.fields.getTextInputValue("text_message_input");
      await welcomeSchema.findOneAndUpdate(
        { guildID: interaction.guild.id },
        { textMessage },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      await syncWelcomePanelMessage(interaction, "Text message updated by");

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Text Message Updated`)
        .setDescription(`${ok} Welcome text message updated by ${interaction.user}.`)
        .addFields({ name: `${getEmoji("info")} New Text Message`, value: `\`${textMessage}\`` });
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      return true;
    }

    if (modalId === "welcome_title_modal") {
      const titleText = interaction.fields.getTextInputValue("title_input");
      await welcomeSchema.findOneAndUpdate(
        { guildID: interaction.guild.id },
        { title: titleText },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      await syncWelcomePanelMessage(interaction, "Title updated by");

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Title Updated`)
        .setDescription(`${ok} Embed title updated to \`${titleText}\` by ${interaction.user}.`);
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      return true;
    }

    const colorText = interaction.fields.getTextInputValue("color_input");
    const parsed = normalizeWelcomeColor(colorText, embedColor);

    if (!parsed) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Invalid Color`)
        .setDescription(`${no} Use hex format like \`#ff0051\` or \`default\`.`);
      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      return true;
    }

    await welcomeSchema.findOneAndUpdate(
      { guildID: interaction.guild.id },
      { embedColor: parsed },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await syncWelcomePanelMessage(interaction, "Color updated by");

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("success")} Color Updated`)
      .setDescription(`${ok} Embed color set to \`${parsed}\` by ${interaction.user}.`);
    await safeReply(interaction, { embeds: [embed], ephemeral: true });
    return true;
  } catch (err) {
    console.error("Error in modal submit handler:", err);
    return true;
  }
}



module.exports = async (client, interaction) => {
  const ownerIds = [String(process.env.OWNERID || "").trim()].filter(Boolean);

  if (interaction.type === InteractionType.ApplicationCommand) {
    await runSlashCommand(client, interaction, ownerIds);
  }

  if (interaction.customId === "evaldelete") {
    if (!ownerIds.includes(interaction.user.id)) return;
    await interaction.message.delete().catch(() => {});
    return;
  }

  if (interaction.type === InteractionType.ModalSubmit) {
    const handled = await handleWelcomeModalSubmit(interaction);
    if (handled) return;
  }


  if (interaction.type === InteractionType.MessageComponent) {
    if (!interaction.customId) return;
    const customId = interaction.customId;
    
    // ============ WELCOME PANEL HANDLERS ============
    if (customId === "welcome_panel") {
      try {
        await safeDeferReply(interaction, { ephemeral: false });
        const data = await welcomeSchema.findOne({ guildID: interaction.guild.id }).catch(() => null);
        const components = buildWelcomeSetupPanel({
          data,
          guild: interaction.guild,
          embedColor: EMBED_COLOR,
        });
        await safeReply(interaction, { components });
      } catch (err) {
        console.error("Error in welcome_panel handler:", err);
      }
      return;
    }

    // Handle String Select Menus (dropdowns)
    if (interaction.isStringSelectMenu?.()) {
      if (customId === "welcome_select_channel" || customId === "welcome_select_role") {
        try {
          if (!hasWelcomeManagePermission(interaction)) {
            const embed = new EmbedBuilder()
              .setColor(EMBED_COLOR)
              .setDescription("*You need `Manage Server` or `Administrator` permission.*");
            return safeReply(interaction, { embeds: [embed], ephemeral: true });
          }

          const selectedValue = interaction.values?.[0];
          const embedColor = EMBED_COLOR;
          const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
          const ok = EMOJIS.ok;
          const no = EMOJIS.no;

          if (customId === "welcome_select_channel") {
            if (selectedValue === "none") {
              const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`${getEmoji("error")} No Channels`)
                .setDescription(`${no} Please create a text channel first.`);
              return safeReply(interaction, { embeds: [embed], ephemeral: true });
            }

            const channel = interaction.guild.channels.cache.get(selectedValue);
            if (!channel) {
              const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`${getEmoji("error")} Channel Not Found`)
                .setDescription(`${no} This channel no longer exists.`);
              return safeReply(interaction, { embeds: [embed], ephemeral: true });
            }

            const currentWelcome = await welcomeSchema.findOne({ guildID: interaction.guild.id }).catch(() => null);

            await welcomeSchema.findOneAndUpdate(
              { guildID: interaction.guild.id },
              { 
                channelID: selectedValue,
                enabled: true,
                embedEnabled: true,
                textEnabled: false,
                message: currentWelcome?.message || DEFAULT_WELCOME_EMBED_MESSAGE,
                textMessage: currentWelcome?.textMessage || DEFAULT_WELCOME_TEXT_MESSAGE,
                title: currentWelcome?.title || DEFAULT_WELCOME_TITLE,
              },
              { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            );

            return refreshWelcomePanel(interaction, `Welcome channel set to <#${selectedValue}> by`);
          }

          if (customId === "welcome_select_role") {
            if (selectedValue === "none") {
              await welcomeSchema.findOneAndUpdate(
                { guildID: interaction.guild.id },
                { roleID: null },
                { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
              );
              return refreshWelcomePanel(interaction, "Auto-role cleared by");
            }

            const role = interaction.guild.roles.cache.get(selectedValue);
            if (!role) {
              const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`${getEmoji("error")} Role Not Found`)
                .setDescription(`${no} This role no longer exists.`);
              return safeReply(interaction, { embeds: [embed], ephemeral: true });
            }

            await welcomeSchema.findOneAndUpdate(
              { guildID: interaction.guild.id },
              { roleID: selectedValue },
              { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            );

            return refreshWelcomePanel(interaction, `Auto-role set to <@&${selectedValue}> by`);
          }
        } catch (err) {
          console.error("Error in select menu handler:", err);
        }
        return;
      }
    }

    // Handle Button Interactions
    if (interaction.isButton?.()) {
      const buttonId = customId;
      
      if (
        buttonId === "welcome_set_message" || 
        buttonId === "welcome_set_text_message" || 
        buttonId === "welcome_set_title" || 
        buttonId === "welcome_set_color" || 
        buttonId === "welcome_clear_role" || 
        buttonId === "welcome_test" || 
        buttonId === "welcome_toggle_embed" || 
        buttonId === "welcome_toggle_text" || 
        buttonId === "welcome_toggle_enable" || 
        buttonId === "welcome_refresh"
      ) {
        try {
          if (!hasWelcomeManagePermission(interaction)) {
            const embed = new EmbedBuilder()
              .setColor(EMBED_COLOR)
              .setDescription("*You need `Manage Server` or `Administrator` permission.*");
            return safeReply(interaction, { embeds: [embed], ephemeral: true });
          }

          const embedColor = EMBED_COLOR;
          const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
          const ok = EMOJIS.ok;
          const no = EMOJIS.no;
          const data = await welcomeSchema.findOne({ guildID: interaction.guild.id }).catch(() => null);

          // Show modals for input buttons
          if (buttonId === "welcome_set_message") {
            const modal = new ModalBuilder()
              .setCustomId("welcome_message_modal")
              .setTitle("Set Embed Message");

            const messageInput = new TextInputBuilder()
              .setCustomId("message_input")
              .setLabel("Embed Message Template")
              .setStyle(TextInputStyle.Paragraph)
              .setValue(data?.message || DEFAULT_WELCOME_EMBED_MESSAGE)
              .setMaxLength(1000);

            modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
            return interaction.showModal(modal);
          }

          if (buttonId === "welcome_set_text_message") {
            const modal = new ModalBuilder()
              .setCustomId("welcome_text_message_modal")
              .setTitle("Set Text Message");

            const textMessageInput = new TextInputBuilder()
              .setCustomId("text_message_input")
              .setLabel("Text Message Template")
              .setStyle(TextInputStyle.Paragraph)
              .setValue(data?.textMessage || DEFAULT_WELCOME_TEXT_MESSAGE)
              .setMaxLength(1000);

            modal.addComponents(new ActionRowBuilder().addComponents(textMessageInput));
            return interaction.showModal(modal);
          }

          if (buttonId === "welcome_set_title") {
            const modal = new ModalBuilder()
              .setCustomId("welcome_title_modal")
              .setTitle("Set Welcome Title");

            const titleInput = new TextInputBuilder()
              .setCustomId("title_input")
              .setLabel("Embed Title")
              .setStyle(TextInputStyle.Short)
              .setValue(data?.title || "Welcome!")
              .setMaxLength(256);

            modal.addComponents(new ActionRowBuilder().addComponents(titleInput));
            return interaction.showModal(modal);
          }

          if (buttonId === "welcome_set_color") {
            const modal = new ModalBuilder()
              .setCustomId("welcome_color_modal")
              .setTitle("Set Embed Color");

            const colorInput = new TextInputBuilder()
              .setCustomId("color_input")
              .setLabel("Hex Color (e.g., #ff0051 or default)")
              .setStyle(TextInputStyle.Short)
              .setValue(data?.embedColor || "#ff0051")
              .setMaxLength(7);

            modal.addComponents(new ActionRowBuilder().addComponents(colorInput));
            return interaction.showModal(modal);
          }

          if (buttonId === "welcome_clear_role") {
            await welcomeSchema.findOneAndUpdate(
              { guildID: interaction.guild.id },
              { roleID: null },
              { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            );
            return refreshWelcomePanel(interaction, "Auto-role cleared by");
          }

          if (buttonId === "welcome_test") {
            await safeDeferReply(interaction, { ephemeral: true });
            const testData = await welcomeSchema.findOne({ guildID: interaction.guild.id });
            if (!testData?.channelID) {
              const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`${getEmoji("error")} Welcome Not Configured`)
                .setDescription(`${no} Select a channel first using the dropdown.`);
              return safeReply(interaction, { embeds: [embed] });
            }

            const channel = interaction.guild.channels.cache.get(testData.channelID);
            if (!channel || !channel.isTextBased()) {
              const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`${getEmoji("error")} Invalid Channel`)
                .setDescription(`${no} The welcome channel no longer exists.`);
              return safeReply(interaction, { embeds: [embed] });
            }

            try {
              const embedPreview = renderWelcomeTemplate(testData.message, interaction.member, DEFAULT_WELCOME_EMBED_MESSAGE);
              const textPreview = renderWelcomeTemplate(testData.textMessage, interaction.member, DEFAULT_WELCOME_TEXT_MESSAGE);
              const embedEnabled = testData.embedEnabled !== false;
              const textEnabled = Boolean(testData.textEnabled);

              if (textEnabled) {
                await channel.send({ content: textPreview }).catch(() => {});
              }

              if (embedEnabled) {
                const testEmbed = new EmbedBuilder()
                  .setColor(testData.embedColor || embedColor)
                  .setTitle(testData.title || DEFAULT_WELCOME_TITLE)
                  .setDescription(embedPreview)
                  .setThumbnail(interaction.user.displayAvatarURL({ forceStatic: false }))
                  .setFooter({ text: `Member #${interaction.guild.memberCount}` });
                await channel.send({ embeds: [testEmbed] }).catch(() => {});
              }

              const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`${getEmoji("success")} Test Sent`)
                .setDescription(`${ok} Welcome preview sent to <#${channel.id}>.`);
              return safeReply(interaction, { embeds: [embed] });
            } catch (err) {
              console.error("Error sending test message:", err);
              const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`${getEmoji("error")} Error`)
                .setDescription(`${no} Failed to send preview.`);
              return safeReply(interaction, { embeds: [embed] });
            }
          }

          if (buttonId === "welcome_refresh") {
            return refreshWelcomePanel(interaction, "Panel refreshed by");
          }

          const currentData = await welcomeSchema.findOne({ guildID: interaction.guild.id }).catch(() => null);

          if (buttonId === "welcome_toggle_embed") {
            const newState = !Boolean(currentData?.embedEnabled !== false);
            await welcomeSchema.findOneAndUpdate(
              { guildID: interaction.guild.id },
              { embedEnabled: newState },
              { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            );
            return refreshWelcomePanel(interaction, `Embed mode ${newState ? "enabled" : "disabled"} by`);
          }

          if (buttonId === "welcome_toggle_text") {
            const newState = !Boolean(currentData?.textEnabled);
            await welcomeSchema.findOneAndUpdate(
              { guildID: interaction.guild.id },
              {
                textEnabled: newState,
                ...(newState && !currentData?.textMessage
                  ? { textMessage: DEFAULT_WELCOME_TEXT_MESSAGE }
                  : {}),
              },
              { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            );
            return refreshWelcomePanel(interaction, `Text mode ${newState ? "enabled" : "disabled"} by`);
          }

          if (buttonId === "welcome_toggle_enable") {
            const newState = !Boolean(currentData?.enabled);
            await welcomeSchema.findOneAndUpdate(
              { guildID: interaction.guild.id },
              { enabled: newState },
              { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            );
            return refreshWelcomePanel(interaction, `Welcome system ${newState ? "enabled" : "disabled"} by`);
          }
        } catch (err) {
          console.error("Error in button handler:", err);
        }
        return;
      }
    }

    const premiumHandled = await runPremiumComponent(client, interaction);
    if (premiumHandled) return;
    await runMusicComponent(client, interaction);
  }
};




