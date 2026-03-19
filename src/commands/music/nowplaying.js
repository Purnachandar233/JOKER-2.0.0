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
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;

    const { channel } = message.member.voice;
    if (!channel) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Voice Channel Required`)
        .setDescription(`${no} You must be connected to a voice channel to use this command.`);
      return message.channel.send({ embeds: [embed] });
    }

    if (message.member.voice.selfDeaf) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Cannot Run While Deafened`)
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`);
      return message.channel.send({ embeds: [embed] });
    }
    const player = client.lavalink.players.get(message.guild.id);
    const tracks = [
      player?.queue?.current,
      ...(Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [])
    ].filter(Boolean);

    if (!player || !tracks || tracks.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("queue")} Nothing Playing`)
        .setDescription(`${no} There is nothing playing in this server.`);
      return message.channel.send({ embeds: [embed] });
    }

    if (channel.id !== player.voiceChannelId) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Wrong Voice Channel`)
        .setDescription(`${no} You must be connected to the same voice channel as me.`);
      return message.channel.send({ embeds: [embed] });
    }

    const song = tracks[0];
    const title = song?.info?.title || song?.title || "Unknown Title";
    const uri = song?.info?.uri || song?.uri || "https://discord.gg/JQzBqgmwFm";
    const author = song?.info?.author || song?.author || "Unknown";
    const isStream = song?.info?.isStream || song?.isStream || false;
    const duration = song?.info?.duration || song?.duration || null;
    const durationStr = isStream ? "LIVE" : (duration ? new Date(duration).toISOString().slice(11, 19) : "Unknown");
    const queueSize = tracks.length;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("music")} Now Playing`)
      .setDescription(`**[${title}](${uri})**`)
      .setAuthor({
        name: `${message.guild.name} Music Session`,
        iconURL: message.guild.iconURL({ forceStatic: false }) || client.user.displayAvatarURL({ forceStatic: false })
      })
      .addFields(
        statField("Artist", `\`${author}\``, "users", true),
        statField("Duration", `\`${durationStr}\``, "duration", true),
        statField("Queue", `\`${queueSize}\` tracks`, "queue", true),
        {
          name: `${getEmoji("time")} Progress`,
          value: createBar(player),
          inline: false
        }
      )
      .setFooter({ text: `${ok} Streaming with Joker Music` });

    return message.channel.send({ embeds: [embed] });
  }
};
