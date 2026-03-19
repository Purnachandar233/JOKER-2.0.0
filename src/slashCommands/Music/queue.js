const { ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const { intpaginationEmbed } = require("../../utils/pagination.js");
const safeReply = require("../../utils/interactionResponder");
const musicChecks = require("../../utils/musicChecks");
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

const EMOJIS = require("../../utils/emoji.json");

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

module.exports = {
  name: "queue",
  description: "Show the music queue and now playing.",
  owner: false,
  player: true,
  inVoiceChannel: true,
  wl: true,
  sameVoiceChannel: false,

  run: async (client, interaction) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const createPaginationButtons = (page = 1, total = 1) => {
      const first = new ButtonBuilder().setCustomId("first").setLabel("First").setStyle(ButtonStyle.Secondary).setDisabled(page <= 1);
      const back = new ButtonBuilder().setCustomId("back").setLabel("Back").setStyle(ButtonStyle.Secondary).setDisabled(page <= 1);
      const next = new ButtonBuilder().setCustomId("next").setLabel("Next").setStyle(ButtonStyle.Primary).setDisabled(page >= total);
      const last = new ButtonBuilder().setCustomId("last").setLabel("Last").setStyle(ButtonStyle.Primary).setDisabled(page >= total);
      try { first.setEmoji(getEmoji("first")); } catch (_e) {}
      try { back.setEmoji(getEmoji("back")); } catch (_e) {}
      try { next.setEmoji(getEmoji("next")); } catch (_e) {}
      try { last.setEmoji(getEmoji("last")); } catch (_e) {}
      return [first, back, next, last];
    };

    return client.errorHandler.executeWithErrorHandling(interaction, async safeInteraction => {
      await safeReply.safeDeferReply(safeInteraction);

      const ok = EMOJIS.ok;
      const no = EMOJIS.no;

      const cooldown = client.cooldownManager.check("queue", safeInteraction.user.id);
      if (cooldown.onCooldown) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("time")} Cooldown Active`)
          .setDescription(`${no} Try again in ${cooldown.remaining()}ms.`);
        return safeReply.safeReply(safeInteraction, { embeds: [embed] });
      }

      const check = await musicChecks.runMusicChecks(client, safeInteraction, {
        inVoiceChannel: true,
        botInVoiceChannel: true,
        sameChannel: false,
        requirePlayer: true,
        requireQueue: true
      });

      if (!check.valid) {
        return safeReply.safeReply(safeInteraction, { embeds: [check.embed] });
      }

      const player = client.lavalink?.players?.get?.(safeInteraction.guildId);
      const currentTrack = player?.queue?.current || null;
      const queue = [
        ...(currentTrack ? [currentTrack] : []),
        ...(Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [])
      ];

      if (!queue || queue.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("queue")} Queue Empty`)
          .setDescription(`${no} There is nothing playing in this server.`);
        return safeReply.safeReply(safeInteraction, { embeds: [embed] });
      }

      const requesterFallback = typeof player?.get === "function" ? player.get("requester") : null;
      const requesterFallbackId = typeof player?.get === "function" ? player.get("requesterId") : null;
      const currentRequester = getRequesterInfo(currentTrack, {
        fallbackRequester: requesterFallback,
        fallbackRequesterId: requesterFallbackId,
        fallbackTag: safeInteraction?.user?.tag,
      });
      const currentTitle = formatQueueTrackTitle(currentTrack, 80);
      const currentMeta = formatQueueTrackMeta(currentTrack, currentRequester.label);
      const currentThumbnail = getTrackThumbnail(currentTrack);
      const timing = getQueueTiming(player);

      const upcomingTracks = queue.slice(1);
      const queueEntries = upcomingTracks.map((track, i) => {
        const requester = getRequesterInfo(track, {
          fallbackRequester: requesterFallback,
          fallbackRequesterId: requesterFallbackId,
          fallbackTag: safeInteraction?.user?.tag,
        });
        const title = truncateText(track?.info?.title || track?.title || "Unknown Title", 60);
        const meta = formatQueueTrackMeta(track, requester.label);
        return `${i + 1}. ${title}\n${meta}`;
      });

      const chunked = chunkArray(queueEntries, 10);
      const embeds = [];
      const queueName = safeInteraction.guild?.name || "Queue";
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

      if (!chunked.length) {
        embeds.push(
          new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`${getEmoji("queue")} Queue ${queueName} (${upcomingTracks.length} tracks)`)
            .setThumbnail(currentThumbnail)
            .setDescription(
              `**Now playing**\n` +
              `${currentTitle}\n` +
              `${currentMeta}\n` +
              `\n**Up next**\n` +
              `There are no songs in the queue.\n` +
              `\n**Settings**\n` +
              `Loop: ${loopMode} | Volume: ${volume}%\n` +
              `Remaining: ${remainingLabel} | Total: ${totalDurationLabel} | Ends: ${finishLabel}`
            )
            .setFooter({ text: "Page 1/1" })
        );
      } else {
        for (let i = 0; i < chunked.length; i++) {
          const upcoming = chunked[i].join("\n\n");
          embeds.push(
            new EmbedBuilder()
              .setColor(embedColor)
              .setTitle(`${getEmoji("queue")} Queue ${queueName} (${upcomingTracks.length} tracks)`)
              .setThumbnail(currentThumbnail)
              .setDescription(
                `**Now playing**\n` +
                `${currentTitle}\n` +
                `${currentMeta}\n` +
                `\n**Up next**\n` +
                `${upcoming}\n` +
                `\n**Settings**\n` +
                `Loop: ${loopMode} | Volume: ${volume}%\n` +
                `Remaining: ${remainingLabel} | Total: ${totalDurationLabel} | Ends: ${finishLabel}`
              )
              .setFooter({ text: `Page ${i + 1}/${chunked.length}` })
          );
        }
      }

      if (embeds.length === 1) {
        await safeReply.safeReply(safeInteraction, { embeds: [embeds[0]] });
      } else {
        const buttonList = createPaginationButtons(1, embeds.length).map(button =>
          ButtonBuilder.from(button).setDisabled(false)
        );
        await intpaginationEmbed(safeInteraction, embeds, buttonList, safeInteraction.member.user, 30000);
      }

      client.cooldownManager.set("queue", safeInteraction.user.id, 1000);
      client.logger.logCommand("queue", safeInteraction.user.id, safeInteraction.guildId, Date.now() - safeInteraction.createdTimestamp, true);

      return ok;
    });
  }
};
