const { EmbedBuilder } = require("discord.js");

const { createBar } = require("../../functions.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "nowplaying",
  category: "music",
  aliases: ["np", "empata", "kyagaana"],
  description: "Shows the current playing song information.",
  owner: false,
  wl: true,
  execute: async (message, args, client) => {
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

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;

    const { channel } = message.member.voice;
    if (!channel) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Voice Channel Required`,
        description: `${no} You must be connected to a voice channel to use this command.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    if (message.member.voice.selfDeaf) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Cannot Run While Deafened`,
        description: `${no} <@${message.member.id}> You cannot run this command while deafened.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    const safePlayer = require("../../utils/safePlayer");
    const { getQueueArray } = require("../../utils/queue.js");
    const player = client.lavalink.players.get(message.guild.id);
    const tracks = getQueueArray(player);

    if (!player || !tracks || tracks.length === 0) {
      const embed = createEmbed({
        title: `${getEmoji("queue")} Nothing Playing`,
        description: `${no} There is nothing playing in this server.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    if (channel.id !== player.voiceChannelId) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Wrong Voice Channel`,
        description: `${no} You must be connected to the same voice channel as me.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    const song = tracks[0];
    const title = song?.info?.title || song?.title || "Unknown Title";
    const uri = song?.info?.uri || song?.uri || "https://discord.gg/JQzBqgmwFm";
    const author = song?.info?.author || song?.author || "Unknown";
    const isStream = song?.info?.isStream || song?.isStream || false;
    const duration = song?.info?.duration || song?.duration || null;
    const durationStr = isStream ? "LIVE" : (duration ? new Date(duration).toISOString().slice(11, 19) : "Unknown");
    const queueSize = safePlayer.queueSize(player);

    const embed = createEmbed({
      title: `${getEmoji("music")} Now Playing`,
      description: `**[${title}](${uri})**`,
      author: {
        name: `${message.guild.name} Music Session`,
        iconURL: message.guild.iconURL({ forceStatic: false }) || client.user.displayAvatarURL({ forceStatic: false })
      },
      fields: [
        statField("Artist", `\`${author}\``, "users", true),
        statField("Duration", `\`${durationStr}\``, "duration", true),
        statField("Queue", `\`${queueSize}\` tracks`, "queue", true),
        {
          name: `${getEmoji("time")} Progress`,
          value: createBar(player),
          inline: false
        }
      ],
      footer: `${ok} Streaming with Joker Music`
    });

    return message.channel.send({ embeds: [embed] });
  }
};

