const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  SectionBuilder,
  TextDisplayBuilder,
} = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const TwentyFourSeven = require("../../schema/twentyfourseven");

const QUEUE_PANEL_PAGE_SIZE = 5;
const QUEUE_PANEL_TIMEOUT_MS = 120000;
const CONTROL_MESSAGE_TIMEOUT_MS = 90000;
const VOICE_BRIDGE_TIMEOUT_MS = 5000;
const NO_PING_ALLOWED_MENTIONS = { parse: [], repliedUser: false };
const SECTION_DIVIDER = "\u2500".repeat(32);
const TRACK_CONTROL_SESSIONS = new Map();
const QUEUE_PANEL_STATES = new Map();

function getLoopMode(player) {
  const mode = player?.repeatMode;
  if (mode === "track" || mode === 1) return "track";
  if (mode === "queue" || mode === 2) return "queue";
  return "off";
}

function getAutoplayMode(player) {
  return player?.get?.("autoplay") === true ? "on" : "off";
}

async function get247Mode(guildId) {
  if (!guildId) return "off";

  const record = await TwentyFourSeven.findOne({ guildID: guildId })
    .select("_id")
    .lean()
    .catch(() => null);
  return record ? "on" : "off";
}

function getPlayerVolume(player) {
  const volume = Number(player?.volume ?? (typeof player?.get === "function" ? player.get("volume") : null));
  if (!Number.isFinite(volume)) return 100;
  return Math.max(0, Math.round(volume));
}

function resolveAccentColor(color) {
  if (typeof color === "number" && Number.isFinite(color)) return color;
  const parsed = parseInt(String(color || "").replace(/^#/, ""), 16);
  return Number.isFinite(parsed) ? parsed : 0xff0051;
}

function getTrackIdentity(track) {
  return String(
    track?.encoded ||
    track?.track ||
    track?.info?.identifier ||
    `${track?.info?.title || track?.title || "Unknown"}::${track?.info?.author || track?.author || "Unknown"}::${track?.info?.duration || track?.duration || 0}`
  );
}

function getRequesterTag(requester) {
  const tag = String(requester?.tag || "").trim();
  if (tag && tag !== "Unknown") return tag.split("#")[0];

  const id = String(requester?.id || "").trim();
  if (id) return `User ${id}`;

  return "Unknown";
}

function getRequesterLine(requester) {
  const tag = String(requester?.tag || "").trim();
  if (tag && tag !== "Unknown") return `@${tag.split("#")[0]}`;

  const id = String(requester?.id || "").trim();
  if (id) return `User ${id}`;

  return "Unknown";
}

function createQueueNavigationRow(pageIndex, totalPages, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("queue_page_first").setLabel("First").setStyle(ButtonStyle.Secondary).setDisabled(disabled || pageIndex <= 0),
    new ButtonBuilder().setCustomId("queue_page_prev").setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(disabled || pageIndex <= 0),
    new ButtonBuilder().setCustomId("queue_page_indicator").setLabel(`Page ${pageIndex + 1}/${Math.max(1, totalPages)}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId("queue_page_next").setLabel("Next").setStyle(ButtonStyle.Primary).setDisabled(disabled || pageIndex >= totalPages - 1),
    new ButtonBuilder().setCustomId("queue_page_last").setLabel("Last").setStyle(ButtonStyle.Primary).setDisabled(disabled || pageIndex >= totalPages - 1),
  );
}

function createTrackControlRow(token, { canMoveUp, canMoveDown }, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`queue_track_play_${token}`).setLabel("Play Now").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`queue_track_up_${token}`).setLabel("Up").setStyle(ButtonStyle.Secondary).setDisabled(disabled || !canMoveUp),
    new ButtonBuilder().setCustomId(`queue_track_down_${token}`).setLabel("Down").setStyle(ButtonStyle.Secondary).setDisabled(disabled || !canMoveDown),
    new ButtonBuilder().setCustomId(`queue_track_top_${token}`).setLabel("Move to Top").setStyle(ButtonStyle.Secondary).setDisabled(disabled || !canMoveUp),
    new ButtonBuilder().setCustomId(`queue_track_remove_${token}`).setLabel("Remove").setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

function buildQueueTrackSubtitle(track, requesterLabel, queueTools) {
  const author = queueTools.truncateText(track?.info?.author || track?.author || "Unknown", 42);
  return `${author} | ${queueTools.formatTrackLength(track)} | ${requesterLabel || "Unknown"}`;
}

function pruneExpiredState(map, now = Date.now()) {
  for (const [key, value] of map.entries()) {
    if (!value || !Number.isFinite(value.expiresAt) || value.expiresAt <= now) {
      map.delete(key);
    }
  }
}

async function resolveQueueSettings(guildId, player) {
  const mode247 = await get247Mode(guildId);

  return {
    loopMode: getLoopMode(player),
    autoplayMode: getAutoplayMode(player),
    mode247,
    volume: getPlayerVolume(player),
  };
}

function buildQueuePanel(player, pageIndex, embedColor, queueTools, {
  panelOwnerName = "Queue",
  userTag = "Unknown",
  disabled = false,
  settings = null,
} = {}) {
  const {
    formatQueueTrackTitle,
    getQueueArray,
    getRequesterInfo,
  } = queueTools;

  const tracks = getQueueArray(player);
  const current = tracks[0] || null;
  const upcoming = tracks.slice(1);
  const totalPages = Math.max(1, Math.ceil(upcoming.length / QUEUE_PANEL_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, pageIndex), totalPages - 1);
  const start = safePage * QUEUE_PANEL_PAGE_SIZE;
  const visibleEntries = upcoming.slice(start, start + QUEUE_PANEL_PAGE_SIZE).map((track, index) => ({
    track,
    queueIndex: start + index,
    queueNumber: start + index + 1,
  }));

  const requesterFallback = typeof player?.get === "function" ? player.get("requester") : null;
  const requesterFallbackId = typeof player?.get === "function" ? player.get("requesterId") : null;
  const loopMode = settings?.loopMode ?? getLoopMode(player);
  const autoplayMode = settings?.autoplayMode ?? getAutoplayMode(player);
  const mode247 = settings?.mode247 ?? "off";
  const volume = settings?.volume ?? getPlayerVolume(player);

  const container = new ContainerBuilder().setAccentColor(resolveAccentColor(embedColor));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## Queue: ${panelOwnerName} (${upcoming.length} Tracks)`)
  );

  if (current) {
    const requester = getRequesterInfo(current, {
      fallbackRequester: requesterFallback,
      fallbackRequesterId: requesterFallbackId,
      fallbackTag: userTag,
    });

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("### Now playing"),
      new TextDisplayBuilder().setContent(
        `${formatQueueTrackTitle(current, 92)}\n${buildQueueTrackSubtitle(current, getRequesterTag(requester), queueTools)}`
      ),
      new TextDisplayBuilder().setContent(SECTION_DIVIDER),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("### Now playing"),
      new TextDisplayBuilder().setContent("*Nothing is currently playing.*"),
      new TextDisplayBuilder().setContent(SECTION_DIVIDER),
    );
  }

  if (!visibleEntries.length) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("*No upcoming tracks in queue.*"));
  } else {
    visibleEntries.forEach((entry, index) => {
      const requester = getRequesterInfo(entry.track, {
        fallbackRequester: requesterFallback,
        fallbackRequesterId: requesterFallbackId,
        fallbackTag: userTag,
      });

      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${entry.queueNumber}.** ${formatQueueTrackTitle(entry.track, 80)}`),
          new TextDisplayBuilder().setContent(buildQueueTrackSubtitle(entry.track, getRequesterTag(requester), queueTools)),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`queue_controls_${index}`)
            .setLabel("...")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
        );

      container.addSectionComponents(section);
      if (index < visibleEntries.length - 1) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(SECTION_DIVIDER));
      }
    });
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(SECTION_DIVIDER),
    new TextDisplayBuilder().setContent(
      `### Settings\n24/7: \`${mode247}\` | Autoplay: \`${autoplayMode}\` | Loop: \`${loopMode}\` | Volume: \`${volume}%\``
    )
  );
  
  if (totalPages > 1) {
    container.addActionRowComponents(createQueueNavigationRow(safePage, totalPages, disabled));
  }

  return {
    components: [container],
    pageIndex: safePage,
    totalPages,
    visibleEntries,
    requesterFallback,
    requesterFallbackId,
  };
}

function buildTrackControlsPayload({
  track,
  queueIndex,
  queueLength,
  token,
  embedColor,
  queueTools,
  requesterFallback,
  requesterFallbackId,
  userTag,
  statusText = null,
  positionLabel = null,
  disabled = false,
}) {
  const { formatQueueTrackTitle, formatTrackLength, getRequesterInfo, getTrackThumbnail } = queueTools;
  const requester = getRequesterInfo(track, {
    fallbackRequester: requesterFallback,
    fallbackRequesterId: requesterFallbackId,
    fallbackTag: userTag,
  });

  const descriptionLines = [
    `${formatQueueTrackTitle(track, 82)}`,
    `Duration: \`${formatTrackLength(track)}\``,
    `Added by: ${getRequesterLine(requester)}`,
    `Queue Position: ${positionLabel || String((queueIndex ?? 0) + 1)}`,
  ];

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle("Track Controls")
    .setDescription(descriptionLines.join("\n"));

  const thumbnail = getTrackThumbnail(track);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (statusText) embed.setFooter({ text: statusText });

  return {
    embeds: [embed],
    components: token
      ? [createTrackControlRow(token, {
          canMoveUp: Number.isInteger(queueIndex) && queueIndex > 0,
          canMoveDown: Number.isInteger(queueIndex) && Number.isInteger(queueLength) && queueIndex < queueLength - 1,
        }, disabled)]
      : [],
  };
}

function moveTrackInList(list, fromIndex, toIndex) {
  const items = Array.isArray(list) ? list.slice() : [];
  if (fromIndex < 0 || fromIndex >= items.length) return items;

  const boundedToIndex = Math.max(0, Math.min(items.length - 1, toIndex));
  const [track] = items.splice(fromIndex, 1);
  items.splice(boundedToIndex, 0, track);
  return items;
}

async function replaceQueueTracks(player, tracks) {
  if (typeof player?.queue?.splice === "function" && Array.isArray(player?.queue?.tracks)) {
    await player.queue.splice(0, player.queue.tracks.length, tracks);
    return;
  }

  if (!player.queue) player.queue = {};
  player.queue.tracks = Array.isArray(tracks) ? tracks.slice() : [];
}

function findQueuedTrack(player, identity) {
  const queueTracks = Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [];
  const queueIndex = queueTracks.findIndex((track) => getTrackIdentity(track) === identity);
  if (queueIndex < 0) return null;

  return {
    queueTracks,
    queueIndex,
    track: queueTracks[queueIndex],
  };
}

function buildToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function rememberQueuePanelState(panelMessageId, data) {
  pruneExpiredState(QUEUE_PANEL_STATES);
  QUEUE_PANEL_STATES.set(panelMessageId, {
    ...data,
    expiresAt: Date.now() + QUEUE_PANEL_TIMEOUT_MS,
  });
}

function rememberTrackControlSession(token, data) {
  pruneExpiredState(TRACK_CONTROL_SESSIONS);
  TRACK_CONTROL_SESSIONS.set(token, {
    ...data,
    expiresAt: Date.now() + CONTROL_MESSAGE_TIMEOUT_MS,
  });
}

async function editTrackControlMessage(interaction, payload) {
  const options = {
    ...payload,
    allowedMentions: NO_PING_ALLOWED_MENTIONS,
  };

  return interaction.editReply(options)
    .catch(() => interaction.update(options).catch(() => null));
}

async function refreshQueuePanelMessage({
  client,
  interaction,
  session,
  player,
  embedColor,
  queueTools,
}) {
  const panelState = QUEUE_PANEL_STATES.get(session.panelMessageId);
  const pageIndex = Number.isInteger(panelState?.pageIndex) ? panelState.pageIndex : 0;
  const settings = await resolveQueueSettings(session.guildId, player);
  const panelPayload = buildQueuePanel(player, pageIndex, embedColor, queueTools, {
    panelOwnerName: panelState?.panelOwnerName || "Queue",
    userTag: panelState?.userTag || interaction.user?.tag || "Unknown",
    settings,
  });

  const panelChannel =
    interaction.channelId === session.channelId
      ? interaction.channel
      : await client.channels.fetch(session.channelId).catch(() => null);

  const panelMessage = await panelChannel?.messages?.fetch?.(session.panelMessageId).catch(() => null);
  if (panelMessage) {
    await panelMessage.edit({
      components: panelPayload.components,
      allowedMentions: NO_PING_ALLOWED_MENTIONS,
    }).catch(() => {});
  }

  if (panelState) {
    rememberQueuePanelState(session.panelMessageId, {
      ...panelState,
      pageIndex: panelPayload.pageIndex,
    });
  }
}

module.exports = {
  name: "queue",
  category: "music",
  aliases: ["q", "list"],
  description: "Displays the music queue.",
  owner: false,
  wl: true,
  handleTrackControlInteraction: async (interaction, client) => {
    if (!interaction?.isButton?.() || !interaction.customId?.startsWith("queue_track_")) {
      return false;
    }

    const match = interaction.customId.match(/^queue_track_(play|up|down|top|remove)_(.+)$/);
    if (!match) return false;

    const action = match[1];
    const token = match[2];
    pruneExpiredState(TRACK_CONTROL_SESSIONS);

    const session = TRACK_CONTROL_SESSIONS.get(token);
    const queueTools = client.core.queue;
    const embedColor = session?.embedColor || client?.embedColor || "#ff0051";

    if (!session) {
      await interaction.update({
        ...buildTrackControlsPayload({
          track: { info: { title: "Track" } },
          queueIndex: null,
          queueLength: 0,
          token,
          embedColor,
          queueTools,
          statusText: "This track panel expired.",
          positionLabel: "Expired",
          disabled: true,
        }),
        allowedMentions: NO_PING_ALLOWED_MENTIONS,
      }).catch(() => {});
      return true;
    }

    if (session.userId !== interaction.user.id) {
      await interaction.reply({
        content: `Only ${session.userTag || "the original user"} can use these track controls.`,
        ephemeral: true,
        allowedMentions: NO_PING_ALLOWED_MENTIONS,
      }).catch(() => {});
      return true;
    }

    if (session.expiresAt <= Date.now()) {
      TRACK_CONTROL_SESSIONS.delete(token);
      await interaction.update({
        ...buildTrackControlsPayload({
          track: session.openedTrack,
          queueIndex: null,
          queueLength: 0,
          token,
          embedColor,
          queueTools,
          userTag: session.userTag,
          statusText: "Track controls expired.",
          positionLabel: "Expired",
          disabled: true,
        }),
        allowedMentions: NO_PING_ALLOWED_MENTIONS,
      }).catch(() => {});
      return true;
    }

    const player = client.lavalink?.players?.get(session.guildId);
    if (!player) {
      TRACK_CONTROL_SESSIONS.delete(token);
      await interaction.update({
        ...buildTrackControlsPayload({
          track: session.openedTrack,
          queueIndex: null,
          queueLength: 0,
          token,
          embedColor,
          queueTools,
          userTag: session.userTag,
          statusText: "The player is no longer active.",
          positionLabel: "Unavailable",
          disabled: true,
        }),
        allowedMentions: NO_PING_ALLOWED_MENTIONS,
      }).catch(() => {});
      return true;
    }

    await interaction.deferUpdate().catch(() => {});

    const queuedTrackState = findQueuedTrack(player, session.identity);
    if (!queuedTrackState) {
      TRACK_CONTROL_SESSIONS.delete(token);
      await editTrackControlMessage(interaction, buildTrackControlsPayload({
        track: session.openedTrack,
        queueIndex: null,
        queueLength: 0,
        token,
        embedColor,
        queueTools,
        userTag: session.userTag,
        statusText: "This track is no longer in the queue.",
        positionLabel: "Unavailable",
        disabled: true,
      }));
      return true;
    }

    const originalTrack = queuedTrackState.track;
    const originalTitle = queueTools.truncateText(originalTrack?.info?.title || originalTrack?.title || "Track", 70);
    let footerText = null;
    let nextPopupTrack = originalTrack;
    let nextQueueIndex = queuedTrackState.queueIndex;
    let disablePopupButtons = false;
    let positionLabel = null;

    try {
      if (action === "remove") {
        await player.queue.remove(queuedTrackState.queueIndex);
        footerText = `Removed ${originalTitle} from the queue.`;
        nextQueueIndex = null;
        positionLabel = "Removed";
        disablePopupButtons = true;
      }

      if (action === "top") {
        const reordered = moveTrackInList(queuedTrackState.queueTracks, queuedTrackState.queueIndex, 0);
        await replaceQueueTracks(player, reordered);
        footerText = `Moved ${originalTitle} to the top of the queue.`;
      }

      if (action === "up") {
        const reordered = moveTrackInList(queuedTrackState.queueTracks, queuedTrackState.queueIndex, queuedTrackState.queueIndex - 1);
        await replaceQueueTracks(player, reordered);
        footerText = `Moved ${originalTitle} up in the queue.`;
      }

      if (action === "down") {
        const reordered = moveTrackInList(queuedTrackState.queueTracks, queuedTrackState.queueIndex, queuedTrackState.queueIndex + 1);
        await replaceQueueTracks(player, reordered);
        footerText = `Moved ${originalTitle} down in the queue.`;
      }

      if (action === "play") {
        const hadActivePlayback = Boolean(player?.queue?.current || player?.playing || player?.paused);

        if (hadActivePlayback) {
          await player.queue.remove(queuedTrackState.queueIndex);
          await player.queue.add(originalTrack, 0);
          await player.skip();
        } else {
          const reordered = queuedTrackState.queueTracks.filter((_track, index) => index !== queuedTrackState.queueIndex);
          await replaceQueueTracks(player, reordered);
          const started = await client.core.music.ensurePlayerPlayback({
            player,
            guild: interaction.guild,
            channelId: player.voiceChannelId,
            directTrack: originalTrack,
            timeoutMs: VOICE_BRIDGE_TIMEOUT_MS,
            recoverVolume: true,
            logger: client.logger,
          });
          if (!started) throw new Error("Failed to start playback.");
        }

        footerText = `Now playing ${originalTitle}.`;
        nextQueueIndex = null;
        positionLabel = "Now playing";
        disablePopupButtons = true;
      }

      await refreshQueuePanelMessage({
        client,
        interaction,
        session,
        player,
        embedColor,
        queueTools,
      });

      if (!disablePopupButtons) {
        const refreshedTrackState = findQueuedTrack(player, session.identity);
        if (refreshedTrackState) {
          nextPopupTrack = refreshedTrackState.track;
          nextQueueIndex = refreshedTrackState.queueIndex;
        } else {
          nextQueueIndex = null;
          disablePopupButtons = true;
          positionLabel = "Unavailable";
        }
      }

      await editTrackControlMessage(interaction, buildTrackControlsPayload({
        track: nextPopupTrack,
        queueIndex: nextQueueIndex,
        queueLength: Array.isArray(player?.queue?.tracks) ? player.queue.tracks.length : 0,
        token,
        embedColor,
        queueTools,
        userTag: session.userTag,
        statusText: footerText,
        positionLabel,
        disabled: disablePopupButtons,
      }));

      if (disablePopupButtons) {
        TRACK_CONTROL_SESSIONS.delete(token);
      } else {
        rememberTrackControlSession(token, {
          ...session,
          openedTrack: nextPopupTrack,
        });
      }
    } catch (error) {
      client.logger?.log?.(error?.stack || error?.message || String(error), "error");
      await editTrackControlMessage(interaction, buildTrackControlsPayload({
        track: originalTrack,
        queueIndex: queuedTrackState.queueIndex,
        queueLength: Array.isArray(player?.queue?.tracks) ? player.queue.tracks.length : 0,
        token,
        embedColor,
        queueTools,
        userTag: session.userTag,
        statusText: "Failed to update that queue track.",
        disabled: false,
      }));
    }

    return true;
  },
  execute: async (message, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const queueTools = client.core.queue;
    const { getQueueArray } = queueTools;
    const { channel } = message.member.voice;

    if (!channel) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Voice Channel Required`)
        .setDescription("Join a voice channel to view the queue.");
      return message.channel.send({ embeds: [embed] });
    }

    if (!client.lavalink) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Audio Backend Offline`)
        .setDescription("Lavalink is not connected yet. Please try again in a moment.");
      return message.channel.send({ embeds: [embed] });
    }

    const player = client.lavalink.players.get(message.guild.id);
    const tracks = getQueueArray(player);

    if (!player || !tracks.length) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: "Queue Empty", iconURL: client.user.displayAvatarURL() })
        .setDescription("Nothing is currently playing.");
      return message.channel.send({ embeds: [embed] });
    }

    if (channel.id !== player.voiceChannelId) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: "Wrong Voice Channel", iconURL: client.user.displayAvatarURL() })
        .setDescription("You must be in the same voice channel as the bot.");
      return message.channel.send({ embeds: [embed] });
    }

    let currentPage = 0;
    const getPanelState = async (disabled = false) => {
      const settings = await resolveQueueSettings(message.guild.id, player);
      const state = buildQueuePanel(player, currentPage, embedColor, queueTools, {
        panelOwnerName: message.member?.displayName || message.author.username,
        userTag: message.member?.user?.tag,
        disabled,
        settings,
      });
      currentPage = state.pageIndex;
      return state;
    };

    let panelState = await getPanelState();
    const panelMessage = await message.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: panelState.components,
      allowedMentions: NO_PING_ALLOWED_MENTIONS,
    });
    rememberQueuePanelState(panelMessage.id, {
      pageIndex: currentPage,
      panelOwnerName: message.member?.displayName || message.author.username,
      userTag: message.member?.user?.tag,
      guildId: message.guild.id,
      channelId: message.channel.id,
    });

    const collector = panelMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: QUEUE_PANEL_TIMEOUT_MS,
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.user.id !== message.author.id) {
        await buttonInteraction.reply({
          content: `Only ${message.author.tag} can use this queue panel.`,
          ephemeral: true,
          allowedMentions: NO_PING_ALLOWED_MENTIONS,
        }).catch(() => {});
        return;
      }

      if (buttonInteraction.customId.startsWith("queue_page_")) {
        if (buttonInteraction.customId === "queue_page_first") currentPage = 0;
        if (buttonInteraction.customId === "queue_page_prev") currentPage = Math.max(0, currentPage - 1);
        if (buttonInteraction.customId === "queue_page_next") currentPage += 1;
        if (buttonInteraction.customId === "queue_page_last") {
          const upNextCount = Math.max(0, getQueueArray(player).length - 1);
          currentPage = Math.max(0, Math.ceil(upNextCount / QUEUE_PANEL_PAGE_SIZE) - 1);
        }

        panelState = await getPanelState();
        rememberQueuePanelState(panelMessage.id, {
          ...(QUEUE_PANEL_STATES.get(panelMessage.id) || {}),
          pageIndex: currentPage,
          panelOwnerName: message.member?.displayName || message.author.username,
          userTag: message.member?.user?.tag,
          guildId: message.guild.id,
          channelId: message.channel.id,
        });
        await buttonInteraction.update({
          components: panelState.components,
          allowedMentions: NO_PING_ALLOWED_MENTIONS,
        }).catch(() => {});
        collector.resetTimer();
        return;
      }

      if (buttonInteraction.customId.startsWith("queue_controls_")) {
        const slot = Number(buttonInteraction.customId.replace("queue_controls_", ""));
        panelState = await getPanelState();
        const entry = panelState.visibleEntries[slot];

        if (!entry) {
          await buttonInteraction.reply({
            content: "That queue slot is empty.",
            ephemeral: true,
            allowedMentions: NO_PING_ALLOWED_MENTIONS,
          }).catch(() => {});
          return;
        }

        const token = buildToken();
        rememberTrackControlSession(token, {
          identity: getTrackIdentity(entry.track),
          openedTrack: entry.track,
          userId: message.author.id,
          userTag: message.author.tag,
          guildId: message.guild.id,
          channelId: message.channel.id,
          panelMessageId: panelMessage.id,
          embedColor,
        });

        const controlReply = buildTrackControlsPayload({
          track: entry.track,
          queueIndex: entry.queueIndex,
          queueLength: Array.isArray(player?.queue?.tracks) ? player.queue.tracks.length : 0,
          token,
          embedColor,
          queueTools,
          requesterFallback: panelState.requesterFallback,
          requesterFallbackId: panelState.requesterFallbackId,
          userTag: message.member?.user?.tag,
        });

        await buttonInteraction.reply({
          ...controlReply,
          ephemeral: true,
          allowedMentions: NO_PING_ALLOWED_MENTIONS,
        }).catch(() => null);
        collector.resetTimer();
      }
    });

    collector.on("end", async () => {
      try {
        QUEUE_PANEL_STATES.delete(panelMessage.id);
        panelState = await getPanelState(true);
        await panelMessage.edit({
          components: panelState.components,
          allowedMentions: NO_PING_ALLOWED_MENTIONS,
        }).catch(() => {});
      } catch (error) {
        client.logger?.log?.(`Queue panel end handler error: ${error?.message || error}`, "warn");
      }
    });
  }
};
