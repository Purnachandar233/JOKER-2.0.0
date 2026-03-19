const { ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const { messagepaginationEmbed } = require("../../utils/pagination.js");
const {
  formatDiscordTimestamp,
  formatDurationLabel,
  formatQueueTrackMeta,
  formatQueueTrackTitle,
  getQueueArray,
  getQueueTiming,
  getRequesterInfo,
  getTrackThumbnail,
  truncateText,
} = require("../../utils/queue.js");

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
  category: "music",
  aliases: ["q", "list"],
  description: "Displays the music queue.",
  owner: false,
  wl: true,
  execute: async (message, args, client) => {
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

    if (!player || !tracks || tracks.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("queue")} Queue Empty`)
        .setDescription("Nothing is currently playing.");
      return message.channel.send({ embeds: [embed] });
    }

    if (channel.id !== player.voiceChannelId) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Wrong Voice Channel`)
        .setDescription("You must be in the same voice channel as the bot.");
      return message.channel.send({ embeds: [embed] });
    }

    const current = tracks[0] || null;
    const requesterFallback = typeof player?.get === "function" ? player.get("requester") : null;
    const requesterFallbackId = typeof player?.get === "function" ? player.get("requesterId") : null;
    const currentRequester = getRequesterInfo(current, {
      fallbackRequester: requesterFallback,
      fallbackRequesterId: requesterFallbackId,
      fallbackTag: message?.member?.user?.tag,
    });
    const currentTitle = formatQueueTrackTitle(current, 80);
    const currentMeta = formatQueueTrackMeta(current, currentRequester.label);
    const currentThumbnail = getTrackThumbnail(current);
    const timing = getQueueTiming(player);

    const allUpcoming = tracks.slice(1);
    const upcoming = allUpcoming.map((track, i) => {
      const requester = getRequesterInfo(track, {
        fallbackRequester: requesterFallback,
        fallbackRequesterId: requesterFallbackId,
        fallbackTag: message?.member?.user?.tag,
      });
      const title = truncateText(track?.info?.title || track?.title || "Unknown Title", 60);
      const meta = formatQueueTrackMeta(track, requester.label);
      return `${i + 1}. ${title}\n${meta}`;
    });

    const pages = chunkArray(upcoming, 10);
    const embeds = [];
    const queueName = message.guild?.name || "Queue";
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

    if (!pages.length) {
      embeds.push(
        new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("queue")} Queue ${queueName} (${allUpcoming.length} tracks)`)
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
      for (let i = 0; i < pages.length; i++) {
        const list = pages[i].join("\n\n") || "*No more tracks in line.*";
        embeds.push(
          new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`${getEmoji("queue")} Queue ${queueName} (${allUpcoming.length} tracks)`)
            .setThumbnail(currentThumbnail)
            .setDescription(
              `**Now playing**\n` +
              `${currentTitle}\n` +
              `${currentMeta}\n` +
              `\n**Up next**\n` +
              `${list}\n` +
              `\n**Settings**\n` +
              `Loop: ${loopMode} | Volume: ${volume}%\n` +
              `Remaining: ${remainingLabel} | Total: ${totalDurationLabel} | Ends: ${finishLabel}`
            )
            .setFooter({ text: `Page ${i + 1}/${pages.length}` })
        );
      }
    }

    if (embeds.length === 1) {
      return message.channel.send({ embeds: [embeds[0]] });
    }

    const buttonList = createPaginationButtons(1, embeds.length).map(button =>
      ButtonBuilder.from(button).setDisabled(false)
    );

    return messagepaginationEmbed(message, embeds, buttonList, message.member.user, 30000);
  }
};
