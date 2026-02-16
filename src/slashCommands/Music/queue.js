const { ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const { intpaginationEmbed } = require("../../utils/pagination.js");
const safeReply = require("../../utils/safeReply");
const musicChecks = require("../../utils/musicChecks");

const EMOJIS = require("../../utils/emoji.json");

function chunkArray(list, size) {
  if (!Array.isArray(list) || size <= 0) return [];
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
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
    const createEmbed = ({ title, description, fields, author, thumbnail, image, footer, timestamp = false }) => {
      const embed = new EmbedBuilder().setColor(embedColor);
      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description);
      if (Array.isArray(fields) && fields.length > 0) embed.addFields(fields);
      if (author) embed.setAuthor(author);
      if (thumbnail) embed.setThumbnail(thumbnail);
      if (image) embed.setImage(image);
return embed;
    };
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
        const embed = createEmbed({
          title: `${getEmoji("time")} Cooldown Active`,
          description: `${no} Try again in ${cooldown.remaining()}ms.`
        });
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

      const queue = await client.playerController.getQueue(safeInteraction.guildId);
      const currentTrack = await client.playerController.getCurrentTrack(safeInteraction.guildId);

      if (!queue || queue.length === 0) {
        const embed = createEmbed({
          title: `${getEmoji("queue")} Queue Empty`,
          description: `${no} There is nothing playing in this server.`
        });
        return safeReply.safeReply(safeInteraction, { embeds: [embed] });
      }

      const currentTitle = currentTrack?.info?.title || currentTrack?.title || "No current track";
      const currentDuration = currentTrack?.info?.isStream || currentTrack?.isStream
        ? "LIVE"
        : (currentTrack?.info?.duration || currentTrack?.duration)
          ? new Date(currentTrack?.info?.duration || currentTrack?.duration).toISOString().slice(11, 19)
          : "Unknown";

      const queueEntries = queue.map((track, i) => {
        const title = track?.info?.title || track?.title || "Unknown Title";
        const duration = track?.info?.duration || track?.duration;
        const isStream = track?.info?.isStream || track?.isStream;
        const durationText = isStream ? "LIVE" : (duration ? new Date(duration).toISOString().slice(11, 19) : "Unknown");
        return `${i + 1}. ${title} - \`${durationText}\``;
      });

      const chunked = chunkArray(queueEntries, 10);
      const embeds = [];

      for (let i = 0; i < chunked.length; i++) {
        const upcoming = chunked[i]?.length ? chunked[i].join("\n") : "*No more tracks in line.*";
        embeds.push(createEmbed({
          title: `${getEmoji("queue")} ${safeInteraction.guild.name} Queue`,
          description: `**Now Playing**\n${currentTitle} - \`${currentDuration}\`\n\n**Upcoming Tracks**\n${upcoming}`,
          footer: `${getEmoji("music")} Page ${i + 1}/${chunked.length}`
        }));
      }

      if (!embeds.length) {
        embeds.push(createEmbed({
          title: `${getEmoji("queue")} ${safeInteraction.guild.name} Queue`,
          description: `**Now Playing**\n${currentTitle} - \`${currentDuration}\`\n\n**Upcoming Tracks**\n*No more tracks in line.*`,
          footer: `${getEmoji("music")} Page 1/1`
        }));
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

