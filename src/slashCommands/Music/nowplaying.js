const { EmbedBuilder } = require("discord.js");

const { createBar } = require("../../functions.js");
const safeReply = require("../../utils/safeReply");
const musicChecks = require("../../utils/musicChecks");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "nowplaying",
  description: "Show now playing song",
  owner: false,
  player: true,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  wl: true,

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
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    return client.errorHandler.executeWithErrorHandling(interaction, async safeInteraction => {
      await safeReply.safeDeferReply(safeInteraction);

      const ok = EMOJIS.ok;
      const no = EMOJIS.no;

      const cooldown = client.cooldownManager.check("nowplaying", safeInteraction.user.id);
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

      const currentTrack = await client.playerController.getCurrentTrack(safeInteraction.guildId);
      const queue = await client.playerController.getQueue(safeInteraction.guildId);

      if (!currentTrack) {
        const embed = createEmbed({
          title: `${getEmoji("queue")} Nothing Playing`,
          description: `${no} No track is currently playing.`
        });
        return safeReply.safeReply(safeInteraction, { embeds: [embed] });
      }

      const title = currentTrack?.info?.title || currentTrack?.title || "Unknown Title";
      const uri = currentTrack?.info?.uri || currentTrack?.uri || "https://discord.gg/JQzBqgmwFm";
      const author = currentTrack?.info?.author || currentTrack?.author || "Unknown";
      const isStream = currentTrack?.info?.isStream || currentTrack?.isStream || false;
      const duration = currentTrack?.info?.duration || currentTrack?.duration || null;
      const durationStr = isStream ? "LIVE" : (duration ? new Date(duration).toISOString().slice(11, 19) : "Unknown");
      const queueSize = queue ? queue.length : 0;

      const embed = createEmbed({
        title: `${getEmoji("music")} Now Playing`,
        description: `**[${title}](${uri})**`,
        fields: [
          statField("Artist", `\`${author}\``, "users", true),
          statField("Duration", `\`${durationStr}\``, "duration", true),
          statField("Queue", `\`${queueSize}\` tracks`, "queue", true),
          {
            name: `${getEmoji("time")} Progress`,
            value: createBar(check.player),
            inline: false
          }
        ],
        footer: `${ok} Live playback panel`
      });

      await safeReply.safeReply(safeInteraction, { embeds: [embed] });

      client.cooldownManager.set("nowplaying", safeInteraction.user.id, 1000);
      client.logger.logCommand("nowplaying", safeInteraction.user.id, safeInteraction.guildId, Date.now() - safeInteraction.createdTimestamp, true);
    });
  }
};

