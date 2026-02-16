const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionType } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";

function getEmoji(client, key, fallback = "") {
  return EMOJIS[key] || fallback;
}

function createEmbed(client, options = {}) {
  const {
    title,
    description,
    fields,
    author,
    thumbnail,
    image,
    footer,
    timestamp = false
  } = options;

  const embed = new EmbedBuilder().setColor(client?.embedColor || EMBED_COLOR);

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (Array.isArray(fields) && fields.length > 0) embed.addFields(fields);
  if (author) embed.setAuthor(author);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);

  const footerText = footer || `${getEmoji(client, "music", "[M]")} Joker Music`;
return embed;
}

function createLinkRow(client) {
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

  return new ActionRowBuilder().addComponents(support, invite, vote);
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

const blacklist = require("../../schema/blacklistSchema.js");
const Premium = require("../../schema/Premium.js");
const safePlayer = require("../../utils/safePlayer");
const { queuepaginationEmbed } = require("../../utils/pagination.js");

const MUSIC_COMPONENT_IDS = new Set(["prtrack", "skiptrack", "looptrack", "showqueue", "stop"]);

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
        return await originalDeferReply(options);
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
        if (interaction.replied) return await originalFollowUp(options);
        if (interaction.deferred) return await originalEditReply(options);
        return await originalReply(options);
      } catch (error) {
        if (
          error?.code === 40060 ||
          /already been acknowledged/i.test(error?.message || "")
        ) {
          if (interaction.deferred) return originalEditReply(options).catch(() => null);
          return originalFollowUp(options).catch(() => null);
        }
        throw error;
      }
    };

    interaction.editReply = async (options = {}) => {
      if (interaction.deferred || interaction.replied) {
        return originalEditReply(options);
      }
      return originalReply(options);
    };

    interaction.followUp = async (options = {}) => {
      if (interaction.deferred || interaction.replied) {
        return originalFollowUp(options);
      }
      return originalReply(options);
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
      const embed = createEmbed(client, {
        title: `${getEmoji(client, "error")} Server Only`,
        description: "This command can only be used inside a server."
      });
      return interaction.editReply({ embeds: [embed] }).catch(() => {});
    }

    const djSchema = require("../../schema/djroleSchema");
    try {
      const djData = await djSchema.findOne({ guildID: interaction.guild.id }).catch(() => null);
      if (djData?.Roleid) {
        if (!interaction.member?.roles?.cache?.has(djData.Roleid)) {
          const embed = createEmbed(client, {
            title: `${getEmoji(client, "error")} DJ Role Required`,
            description: `<@${interaction.member.id}> You need the configured DJ role to use this command.`
          });
          return interaction.editReply({ embeds: [embed] }).catch(() => {});
        }
      } else if (!ownerIds.includes(interaction.user.id)) {
        const embed = createEmbed(client, {
          title: `${getEmoji(client, "error")} DJ Role Not Configured`,
          description: `<@${interaction.member.id}> No DJ role is configured yet. Contact a server admin.`
        });
        return interaction.editReply({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      client.logger?.log?.(`DJ role check error: ${err?.message || err}`, "error");
      const embed = createEmbed(client, {
        title: `${getEmoji(client, "error")} Permission Check Failed`,
        description: "I couldn't verify DJ permissions. Please try again."
      });
      return interaction.editReply({ embeds: [embed] }).catch(() => {});
    }
  }

  if (slashCommand.wl) {
    const blocked = await blacklist.findOne({ UserID: interaction.member?.id }).catch(() => null);
    if (blocked && !ownerIds.includes(interaction.member?.id)) {
      const embed = createEmbed(client, {
        title: `${getEmoji(client, "error")} Access Blocked`,
        description: `<@${interaction.member.id}> You are blacklisted from using the bot.`
      });
      return interaction.editReply({ embeds: [embed] }).catch(() => {});
    }
  }

  if (slashCommand.owneronly && !ownerIds.includes(interaction.user.id)) {
    const embed = createEmbed(client, {
      title: `${getEmoji(client, "error")} Owner Only`,
      description: "This command is restricted to the bot owner."
    });
    return interaction.editReply({ embeds: [embed] }).catch(() => {});
  }

  if (slashCommand.premium) {
    const isVoted = client.topgg && typeof client.topgg.hasVoted === "function"
      ? await client.topgg.hasVoted(interaction.user.id).catch(err => {
          if (
            err &&
            (err.statusCode === 401 || (err.message && (err.message.includes("401") || err.message.includes("Unauthorized"))))
          ) {
            return false;
          }
          client.logger?.log(`Top.gg vote check error: ${err?.message || String(err)}`, "warn");
          return false;
        })
      : false;

    const pUser = await Premium.findOne({ Id: interaction.user.id, Type: "user" });
    const pGuild = interaction.guild?.id
      ? await Premium.findOne({ Id: interaction.guild.id, Type: "guild" })
      : null;

    const isUserPremium = pUser && (pUser.Permanent || pUser.Expire > Date.now());
    const isGuildPremium = pGuild && (pGuild.Permanent || pGuild.Expire > Date.now());

    if (pUser && !pUser.Permanent && pUser.Expire <= Date.now()) {
      await pUser.deleteOne();
    }
    if (pGuild && !pGuild.Permanent && pGuild.Expire <= Date.now()) {
      await pGuild.deleteOne();
    }

    if (!isUserPremium && !isGuildPremium && !isVoted) {
      const embed = createEmbed(client, {
        title: `${getEmoji(client, "premium")} Premium Required`,
        description: "This command needs a premium subscription or an active Top.gg vote."
      });
      return interaction.editReply({ embeds: [embed], components: [createLinkRow(client)] }).catch(() => {});
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

  switch (normalizedCustomId) {
    case "prtrack": {
      try {
        const isPaused = Boolean(player.paused);
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

        if (!isPaused) {
          let result = await safePlayer.safeCall(player, "pause");
          if (result === false) {
            await sleep(200);
            result = await safePlayer.safeCall(player, "pause");
          }
          await sleep(200);
        } else {
          let result = await safePlayer.safeCall(player, "play");
          if (result === false) {
            await sleep(200);
            result = await safePlayer.safeCall(player, "pause", false);
          }
          if (result === false) {
            await sleep(200);
            await safePlayer.safeCall(player, "play");
          }
          await sleep(250);
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

    case "skiptrack": {
      try {
        const { getQueueArray } = require("../../utils/queue.js");
        const queue = getQueueArray(player) || [];
        const reportedSize = safePlayer.queueSize(player);
        const upcomingCount = Math.max(
          0,
          queue.length > 0 ? queue.length - 1 : 0,
          reportedSize > 0 ? reportedSize - 1 : 0
        );

        if (upcomingCount > 0) {
          try {
            await safePlayer.safeStop(player);
          } catch (_err) {
            await safePlayer.safeStop(player).catch(() => {});
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
          player.setRepeatMode("off");
          await interaction.editReply({ content: `${ok} Loop disabled.` }).catch(() => {});
        } else {
          player.setRepeatMode("track");
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
        const { getQueueArray } = require("../../utils/queue.js");
        const tracks = getQueueArray(player) || [];
        if (!tracks.length) {
          await interaction.editReply({ content: `${no} Queue is empty.` }).catch(() => {});
          return;
        }

        const current = tracks[0] || null;
        const upcoming = tracks.slice(1);

        const queueLines = upcoming.map((track, index) => {
          const title = track?.info?.title?.substring(0, 40) || track?.title?.substring(0, 40) || "Unknown Title";
          const duration = track?.info?.duration || track?.duration;
          const isStream = track?.info?.isStream || track?.isStream;
          const durationStr = isStream
            ? "LIVE"
            : duration
              ? new Date(duration).toISOString().slice(14, 19)
              : "Unknown";
          return `**${index + 1}.** ${title} \`[${durationStr}]\``;
        });

        const grouped = chunkArray(queueLines, 10);
        const embeds = [];
        const nowTitle = current?.info?.title || current?.title || "No current track";

        if (!grouped.length) {
          embeds.push(createEmbed(client, {
            title: `${getEmoji(client, "queue")} Current Queue`,
            author: { name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined },
            description: `**Now Playing**\n- ${nowTitle}\n\n**Upcoming Tracks**\n*No more tracks in line.*`
          }));
        } else {
          for (const pageLines of grouped) {
            embeds.push(createEmbed(client, {
              title: `${getEmoji(client, "queue")} Current Queue`,
              author: { name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined },
              description: `**Now Playing**\n- ${nowTitle}\n\n**Upcoming Tracks**\n${pageLines.join("\n")}`
            }));
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
          await safePlayer.safeStop(player);
        } catch (err) {
          client.logger?.log(`Stop action error: ${err?.stack || err}`, "error");
          await safePlayer.safeDestroy(player).catch(() => {});
        }

        await safePlayer.queueClear(player).catch(() => {});
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

