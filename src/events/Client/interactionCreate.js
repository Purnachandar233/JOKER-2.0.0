const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionType } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";

const blacklist = require("../../schema/blacklistSchema.js");
const { resolvePremiumAccess } = require("../../utils/premiumAccess");

const MUSIC_COMPONENT_IDS = new Set(["prevtrack", "prtrack", "skiptrack", "shufflequeue", "looptrack", "showqueue", "stop"]);
const PREMIUM_COMPONENT_IDS = new Set(["premium_dashboard_activate", "premium_dashboard_deactivate"]);
const EPHEMERAL_FLAG = 1 << 6;

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const DEFAULT_LAVALINK_COMMAND_WAIT_MS = toPositiveNumber(process.env.LAVALINK_COMMAND_WAIT_MS, 2500);
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

    const djSchema = require("../../schema/djroleSchema");
    try {
      const djData = await djSchema.findOne({ guildID: interaction.guild.id }).catch(() => null);
      if (djData?.Roleid) {
        if (!interaction.member?.roles?.cache?.has(djData.Roleid)) {
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
    const blocked = await blacklist.findOne({ UserID: interaction.member?.id }).catch(() => null);
    if (blocked && !ownerIds.includes(interaction.member?.id)) {
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

  // Premium / Vote Lock Check
  if (slashCommand.votelock || slashCommand.voteOnly || slashCommand.premium) {
    const { hasAccess } = await resolvePremiumAccess(interaction.user.id, interaction.guild?.id, client);

    if (!hasAccess) {
      const isPremiumCommand = Boolean(slashCommand.premium);
      const embed = new EmbedBuilder()
        .setColor(client?.embedColor || EMBED_COLOR)
        .setTitle(`${getEmoji(client, "premium")} ${isPremiumCommand ? "Premium Required" : "Vote Required"}`)
        .setDescription(
          isPremiumCommand
            ? `This command requires Premium.\n\nVote here:\nhttps://top.gg/bot/${client.user.id}/vote`
            : `You must vote to use this command.\n\nVote here:\nhttps://top.gg/bot/${client.user.id}/vote`
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

      return interaction.reply({
        embeds: [embed],
        components: [linkRow],
        ephemeral: true
      }).catch(() => {});
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

  try {
    await slashCommand.run(client, interaction);
  } catch (error) {
    const { logError } = require("../../utils/errorHandler");
    await logError(client, error, {
      source: "SlashCommand",
      command: interaction.commandName,
      user: interaction.user?.id,
      guild: interaction.guild?.id,
      channel: interaction.channel?.id
    });

    const no = EMOJIS.no;
    const errorMsg = error?.message || error?.toString() || "An unknown error occurred";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `${no} Error: ${errorMsg}` }).catch(() => {});
    } else {
      await interaction.reply({ content: `${no} Error: ${errorMsg}`, ephemeral: true }).catch(() => {});
    }
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
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }
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
    .setURL("https://discord.gg/JQzBqgmwFm");

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
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }
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
          ? "Premium is already active for your effective access scope.\nYou can still vote to extend temporary windows."
          : "Vote on Top.gg for temporary premium access, or join support for long-term premium activation."
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

module.exports = async (client, interaction) => {
  const ownerIds = Array.isArray(client.config.ownerId)
    ? client.config.ownerId
    : [client.config.ownerId].filter(Boolean);

  if (interaction.type === InteractionType.ApplicationCommand) {
    await runSlashCommand(client, interaction, ownerIds);
  }

  if (interaction.customId === "evaldelete") {
    if (!ownerIds.includes(interaction.user.id)) return;
    await interaction.message.delete().catch(() => {});
    return;
  }

  if (interaction.type === InteractionType.MessageComponent) {
    if (!interaction.customId) return;
    const premiumHandled = await runPremiumComponent(client, interaction);
    if (premiumHandled) return;
    await runMusicComponent(client, interaction);
  }
};


