const { EmbedBuilder } = require("discord.js");

const { createBar } = require("../../functions.js");
const safeReply = require("../../utils/interactionResponder");

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
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("time")} Cooldown Active`)
          .setDescription(`${no} Try again in ${cooldown.remaining()}ms.`);
        return safeReply.safeReply(safeInteraction, { embeds: [embed] });
      }

      const check = await client.runMusicChecks(safeInteraction, {
        inVoiceChannel: true,
        botInVoiceChannel: true,
        sameChannel: false,
        requirePlayer: true,
        requireQueue: true
      });

      if (!check.valid) {
        return safeReply.safeReply(safeInteraction, { embeds: [check.embed] });
      }

      const player = check.player;
      const currentTrack = player?.queue?.current || null;
      const queue = [
        ...(currentTrack ? [currentTrack] : []),
        ...(Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [])
      ];

      if (!currentTrack) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("queue")} Nothing Playing`)
          .setDescription(`${no} No track is currently playing.`);
        return safeReply.safeReply(safeInteraction, { embeds: [embed] });
      }

      const title = currentTrack?.info?.title || currentTrack?.title || "Unknown Title";
      const uri = currentTrack?.info?.uri || currentTrack?.uri || "https://discord.gg/JQzBqgmwFm";
      const author = currentTrack?.info?.author || currentTrack?.author || "Unknown";
      const isStream = currentTrack?.info?.isStream || currentTrack?.isStream || false;
      const duration = currentTrack?.info?.duration || currentTrack?.duration || null;
      const durationStr = isStream ? "LIVE" : (duration ? new Date(duration).toISOString().slice(11, 19) : "Unknown");
      const queueSize = queue ? queue.length : 0;

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("music")} Now Playing`)
        .setDescription(`**[${title}](${uri})**`)
        .addFields(
          statField("Artist", `\`${author}\``, "users", true),
          statField("Duration", `\`${durationStr}\``, "duration", true),
          statField("Queue", `\`${queueSize}\` tracks`, "queue", true),
          {
            name: `${getEmoji("time")} Progress`,
            value: createBar(check.player),
            inline: false
          }
        )
        .setFooter({ text: `${ok} Live playback panel` });

      await safeReply.safeReply(safeInteraction, { embeds: [embed] });

      client.cooldownManager.set("nowplaying", safeInteraction.user.id, 1000);
      client.logger.logCommand("nowplaying", safeInteraction.user.id, safeInteraction.guildId, Date.now() - safeInteraction.createdTimestamp, true);
    });
  }
};

