const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionType } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";

const blacklist = require("../../schema/blacklistSchema.js");
const { resolvePremiumAccess } = require("../../utils/premiumAccess");
const { queuepaginationEmbed } = require("../../utils/pagination.js");
const formatDuration = require("../../utils/formatDuration");
const {
  formatDiscordTimestamp,
  formatDurationLabel,
  formatQueueTrackMeta,
  formatQueueTrackTitle,
  getQueueTiming,
  getRequesterInfo,
  getTrackThumbnail,
  truncateText,
} = require("../../utils/queue");

const MUSIC_COMPONENT_IDS = new Set(["prevtrack", "prtrack", "skiptrack", "shufflequeue", "looptrack", "showqueue", "stop"]);
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

function createPaginationButtons(client, page = 1, total = 1) {
  const first = new ButtonBuilder()
    .setCustomId("first")
    .setLabel("First")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 1);

  const back = new ButtonBuilder()
    .setCustomId("back")
    .setLabel("Back")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 1);

  const next = new ButtonBuilder()
    .setCustomId("next")
    .setLabel("Next")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page >= total);

  const last = new ButtonBuilder()
    .setCustomId("last")
    .setLabel("Last")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page >= total);

  try { first.setEmoji(getEmoji(client, "first")); } catch (_e) {}
  try { back.setEmoji(getEmoji(client, "back")); } catch (_e) {}
  try { next.setEmoji(getEmoji(client, "next")); } catch (_e) {}
  try { last.setEmoji(getEmoji(client, "last")); } catch (_e) {}

  return [first, back, next, last];
}

function chunkArray(list, size) {
  if (!Array.isArray(list) || size <= 0) return [];
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

function getLoopMode(player) {
  const mode = player?.repeatMode;
  if (mode === "track" || mode === 1) return "track";
  if (mode === "queue" || mode === 2) return "queue";
  return "off";
}

function getPlayerVolume(player) {
  const volume = Number(player?.volume ?? (typeof player?.get === "function" ? player.get("volume") : null));
  if (!Number.isFinite(volume)) return 100;
  return Math.max(0, Math.round(volume));
}

function formatTrackLength(track) {
  const isStream = Boolean(track?.info?.isStream || track?.isStream);
  if (isStream) return "LIVE";
  const ms = Number(track?.info?.duration || track?.duration || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "Unknown";
  return formatDuration(ms, { verbose: false, unitCount: 2 });
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
        const tracks = [
          player?.queue?.current,
          ...(Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [])
        ].filter(Boolean);
        if (!tracks.length) {
          await interaction.editReply({ content: `${no} Queue is empty.` }).catch(() => {});
          return;
        }

        const current = tracks[0] || null;
        const upcoming = tracks.slice(1);
        const requesterFallback = typeof player?.get === "function" ? player.get("requester") : null;
        const requesterFallbackId = typeof player?.get === "function" ? player.get("requesterId") : null;
        const nowRequester = getRequesterInfo(current, {
          fallbackRequester: requesterFallback,
          fallbackRequesterId: requesterFallbackId,
          fallbackTag: interaction?.user?.tag,
        });
        const nowTitle = formatQueueTrackTitle(current, 80);
        const nowMeta = formatQueueTrackMeta(current, nowRequester.label);
        const nowThumbnail = getTrackThumbnail(current);
        const timing = getQueueTiming(player);
        const loopMode = getLoopMode(player);
        const volume = getPlayerVolume(player);
        const queueName = interaction.guild?.name || "Queue";

        const queueLines = upcoming.map((track, index) => {
          const title = track?.info?.title?.substring(0, 60) || track?.title?.substring(0, 60) || "Unknown Title";
          const author = track?.info?.author || track?.author || "Unknown";
          const durationStr = formatTrackLength(track);
          return `${index + 1}. ${title} — ${author} • ${durationStr}`;
        });

        const grouped = chunkArray(queueLines, 10);
        const embeds = [];

        if (true) {
          const formattedGroups = chunkArray(
            upcoming.map((track, index) => {
              const requester = getRequesterInfo(track, {
                fallbackRequester: requesterFallback,
                fallbackRequesterId: requesterFallbackId,
                fallbackTag: interaction?.user?.tag,
              });
              const title = truncateText(track?.info?.title || track?.title || "Unknown Title", 60);
              const meta = formatQueueTrackMeta(track, requester.label);
              return `${index + 1}. ${title}\n${meta}`;
            }),
            10
          );
          const totalDurationLabel = timing.hasLive
            ? `${formatDurationLabel(timing.totalDurationMs)} + live`
            : formatDurationLabel(timing.totalDurationMs);
          const remainingLabel = timing.hasLive
            ? `${formatDurationLabel(timing.remainingKnownMs)} + live`
            : formatDurationLabel(timing.remainingKnownMs);
          const finishLabel = timing.finishAt
            ? formatDiscordTimestamp(timing.finishAt, "t")
            : (timing.hasLive ? "live/unknown" : "unknown");

          const createQueueEmbed = (pageContent, pageNumber, totalPages) => (
            new EmbedBuilder()
              .setColor(client?.embedColor || EMBED_COLOR)
              .setTitle(`${getEmoji(client, "queue")} Queue ${queueName} (${upcoming.length} tracks)`)
              .setThumbnail(nowThumbnail)
              .setDescription(
                `**Now playing**\n` +
                `${nowTitle}\n` +
                `${nowMeta}\n` +
                `\n**Up next**\n` +
                `${pageContent}\n` +
                `\n**Settings**\n` +
                `Loop: ${loopMode} | Volume: ${volume}%\n` +
                `Remaining: ${remainingLabel} | Total: ${totalDurationLabel} | Ends: ${finishLabel}`
              )
              .setFooter({ text: `Page ${pageNumber}/${totalPages}` })
          );

          if (!formattedGroups.length) {
            embeds.push(createQueueEmbed("There are no songs in the queue.", 1, 1));
          } else {
            for (let pageIndex = 0; pageIndex < formattedGroups.length; pageIndex++) {
              embeds.push(
                createQueueEmbed(
                  formattedGroups[pageIndex].join("\n\n"),
                  pageIndex + 1,
                  formattedGroups.length
                )
              );
            }
          }
        } else if (!grouped.length) {
          embeds.push(
            new EmbedBuilder()
              .setColor(client?.embedColor || EMBED_COLOR)
              .setTitle(`${getEmoji(client, "queue")} Queue`)
              .setDescription(
                `Queue: ${queueName} (${upcoming.length} tracks)\n` +
                `\nNow playing\n` +
                `${nowTitle}\n` +
                `by ${nowAuthor} • ${nowDuration} • ${nowRequester}\n` +
                `\nUp next\n` +
                `There are no songs in the queue.\n` +
                `\nSettings\n` +
                `Loop: ${loopMode} | Volume: ${volume}%`
              )
          );
        } else {
          for (let pageIndex = 0; pageIndex < grouped.length; pageIndex++) {
            const pageLines = grouped[pageIndex];
            embeds.push(
              new EmbedBuilder()
                .setColor(client?.embedColor || EMBED_COLOR)
                .setTitle(`${getEmoji(client, "queue")} Queue`)
                .setDescription(
                  `Queue: ${queueName} (${upcoming.length} tracks)\n` +
                  `\nNow playing\n` +
                  `${nowTitle}\n` +
                  `by ${nowAuthor} • ${nowDuration} • ${nowRequester}\n` +
                  `\nUp next\n` +
                  `${pageLines.join("\n")}\n` +
                  `\nSettings\n` +
                  `Loop: ${loopMode} | Volume: ${volume}%`
                )
                .setFooter({ text: `${getEmoji(client, "music")} Page ${pageIndex + 1}/${grouped.length}` })
            );
          }
        }

        if (embeds.length === 1) {
          await interaction.editReply({ embeds: [embeds[0]] }).catch(() => {});
          return;
        }

        const buttonList = createPaginationButtons(client, 1, embeds.length).map(button =>
          button.setDisabled(false)
        );
        await queuepaginationEmbed(interaction, embeds, buttonList, interaction.member.user, 30000);
      } catch (error) {
        client.logger?.log(`Queue display error: ${error?.message || error}`, "error");
        await interaction.editReply({ content: `${no} Failed to display queue.` }).catch(() => {});
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
    await runMusicComponent(client, interaction);
  }
};

