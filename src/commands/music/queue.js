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

const {
  formatDiscordTimestamp,
  formatDurationLabel,
  formatQueueTrackMeta,
  formatQueueTrackTitle,
  getQueueArray,
  getQueueTiming,
  getRequesterInfo,
} = require("../../utils/queue.js");

const EMOJIS = require("../../utils/emoji.json");

const QUEUE_PANEL_PAGE_SIZE = 5;

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

function getRequesterDisplayLabel(requester) {
  const tag = String(requester?.tag || "").trim();
  if (tag && tag !== "Unknown") return `\`${tag}\``;

  const id = requester?.id ? String(requester.id) : "";
  if (id) return `User ${id}`;

  return "Unknown";
}

function createQueueControlRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("queue_refresh").setLabel("Refresh").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("queue_close").setLabel("Close").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
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

function buildClosedQueueComponents(text, embedColor) {
  return [
    new ContainerBuilder()
      .setAccentColor(resolveAccentColor(embedColor))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(text)),
  ];
}

function buildQueuePanel(player, pageIndex, embedColor, getEmoji, {
  guildName = "Queue",
  userTag = "Unknown",
  disabled = false,
} = {}) {
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
  const currentRequester = getRequesterInfo(current, {
    fallbackRequester: requesterFallback,
    fallbackRequesterId: requesterFallbackId,
    fallbackTag: userTag,
  });
  const currentRequesterLabel = getRequesterDisplayLabel(currentRequester);

  const timing = getQueueTiming(player);
  const loopMode = getLoopMode(player);
  const volume = getPlayerVolume(player);
  const totalDurationLabel = timing.hasLive
    ? `${formatDurationLabel(timing.totalDurationMs)} + live`
    : formatDurationLabel(timing.totalDurationMs);
  const remainingLabel = timing.hasLive
    ? `${formatDurationLabel(timing.remainingKnownMs)} + live`
    : formatDurationLabel(timing.remainingKnownMs);
  const finishLabel = timing.finishAt
    ? formatDiscordTimestamp(timing.finishAt, "t")
    : (timing.hasLive ? "live/unknown" : "unknown");

  const container = new ContainerBuilder().setAccentColor(resolveAccentColor(embedColor));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${getEmoji("queue")} Queue for **${guildName}**`),
    new TextDisplayBuilder().setContent(`Tracks: **${tracks.length}** total | **${upcoming.length}** up next`),
  );

  if (current) {
    const nowSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("### Now Playing"),
        new TextDisplayBuilder().setContent(`${formatQueueTrackTitle(current, 90)}\n${formatQueueTrackMeta(current, currentRequesterLabel)}`),
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId("queue_add_now")
          .setLabel("Add")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled)
      );
    container.addSectionComponents(nowSection);
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("*Nothing is currently playing.*"));
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
      const requesterLabel = getRequesterDisplayLabel(requester);

      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${entry.queueNumber}.** ${formatQueueTrackTitle(entry.track, 85)}`),
          new TextDisplayBuilder().setContent(formatQueueTrackMeta(entry.track, requesterLabel)),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`queue_remove_${index}`)
            .setLabel("Remove")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
        );

      container.addSectionComponents(section);
    });
  }

  container
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Loop: **${loopMode}** | Volume: **${volume}%**\nRemaining: **${remainingLabel}** | Total: **${totalDurationLabel}** | Ends: **${finishLabel}**`
      )
    )
    .addActionRowComponents(createQueueControlRow(disabled))
    .addActionRowComponents(createQueueNavigationRow(safePage, totalPages, disabled));

  return {
    components: [container],
    pageIndex: safePage,
    totalPages,
    visibleEntries,
  };
}

module.exports = {
  name: "queue",
  category: "music",
  aliases: ["q", "list"],
  description: "Displays the music queue.",
  owner: false,
  wl: true,
  execute: async (message, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const ok = EMOJIS.ok;
    const no = EMOJIS.no;

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
        .setAuthor({ name: `Queue Empty`, iconURL: client.user.displayAvatarURL() })
        .setDescription("Nothing is currently playing.");
      return message.channel.send({ embeds: [embed] });
    }

    if (channel.id !== player.voiceChannelId) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: `Wrong Voice Channel`, iconURL: client.user.displayAvatarURL() })
        .setDescription("You must be in the same voice channel as the bot.");
      return message.channel.send({ embeds: [embed] });
    }

    let currentPage = 0;
    const getPanelState = (disabled = false) => {
      const state = buildQueuePanel(player, currentPage, embedColor, getEmoji, {
        guildName: message.guild?.name || "Queue",
        userTag: message?.member?.user?.tag,
        disabled,
      });
      currentPage = state.pageIndex;
      return state;
    };

    let panelState = getPanelState();
    const panelMessage = await message.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: panelState.components,
    });

    const collector = panelMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.user.id !== message.author.id) {
        await buttonInteraction.reply({
          content: `Only <@${message.author.id}> can use this queue panel.`,
          ephemeral: true,
        }).catch(() => {});
        return;
      }

      if (buttonInteraction.customId === "queue_close") {
        await buttonInteraction.update({
          components: buildClosedQueueComponents(`${ok} Queue panel closed.`, embedColor),
        }).catch(() => {});
        collector.stop("closed");
        return;
      }

      if (buttonInteraction.customId === "queue_refresh") {
        panelState = getPanelState();
        await buttonInteraction.update({
          components: panelState.components,
        }).catch(() => {});
        collector.resetTimer();
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

        panelState = getPanelState();
        await buttonInteraction.update({
          components: panelState.components,
        }).catch(() => {});
        collector.resetTimer();
        return;
      }

      if (buttonInteraction.customId === "queue_add_now") {
        const currentTrack = player?.queue?.current || null;
        if (!currentTrack) {
          await buttonInteraction.reply({ content: "No track is currently playing.", ephemeral: true }).catch(() => {});
          return;
        }

        await buttonInteraction.deferUpdate().catch(() => {});
        try {
          await player.queue.add([currentTrack]);
          panelState = getPanelState();
          await panelMessage.edit({ components: panelState.components }).catch(() => {});
          await buttonInteraction.followUp({
            embeds: [
              new EmbedBuilder()
                .setColor(embedColor)
                .setDescription(`${ok} Added current track to the end of queue.`),
            ],
            ephemeral: true,
          }).catch(() => {});
        } catch (error) {
          client.logger?.log?.(error?.stack || error?.message || String(error), "error");
          await buttonInteraction.followUp({
            embeds: [
              new EmbedBuilder()
                .setColor(embedColor)
                .setDescription(`${no} Failed to add current track.`),
            ],
            ephemeral: true,
          }).catch(() => {});
        }
        collector.resetTimer();
        return;
      }

      if (buttonInteraction.customId.startsWith("queue_remove_")) {
        const slot = Number(buttonInteraction.customId.replace("queue_remove_", ""));
        panelState = getPanelState();
        const entry = panelState.visibleEntries[slot];

        if (!entry) {
          await buttonInteraction.reply({ content: "That queue slot is empty.", ephemeral: true }).catch(() => {});
          return;
        }

        await buttonInteraction.deferUpdate().catch(() => {});
        try {
          const queueTracks = Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [];
          const expectedIdentity = getTrackIdentity(entry.track);
          let removeIndex = queueTracks.findIndex((track) => getTrackIdentity(track) === expectedIdentity);

          if (removeIndex < 0) removeIndex = entry.queueIndex;
          if (removeIndex < 0 || removeIndex >= queueTracks.length) throw new Error("Track not found in queue.");

          await player.queue.remove(removeIndex);
          panelState = getPanelState();
          await panelMessage.edit({ components: panelState.components }).catch(() => {});
          await buttonInteraction.followUp({
            embeds: [
              new EmbedBuilder()
                .setColor(embedColor)
                .setDescription(`${ok} Removed **${formatQueueTrackTitle(entry.track, 55)}** from queue.`),
            ],
            ephemeral: true,
          }).catch(() => {});
        } catch (error) {
          client.logger?.log?.(error?.stack || error?.message || String(error), "error");
          await buttonInteraction.followUp({
            embeds: [
              new EmbedBuilder()
                .setColor(embedColor)
                .setDescription(`${no} Failed to remove that track from queue.`),
            ],
            ephemeral: true,
          }).catch(() => {});
        }
        collector.resetTimer();
      }
    });

    collector.on("end", async (_collected, reason) => {
      if (reason === "closed") return;
      try {
        panelState = getPanelState(true);
        await panelMessage.edit({
          components: panelState.components,
        }).catch(() => {});
      } catch (error) {
        client.logger?.log?.(`Queue panel end handler error: ${error?.message || error}`, "warn");
      }
    });
  }
};
