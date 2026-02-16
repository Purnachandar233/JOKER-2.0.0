const { EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const VALID_REGIONS = [
  "us-west", "brazil", "hongkong", "india", "japan", "rotterdam", "russia",
  "singapore", "south-korea", "southafrica", "sydney", "us-central", "us-east", "us-south"
];

module.exports = {
  name: "fix",
  category: "settings",
  description: "Force update voice region to resolve playback routing issues.",
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

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;

    if (!message.member.permissions.has("MANAGE_CHANNELS")) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Missing Permission`,
        description: "You need `MANAGE_CHANNELS` to run this command."
      });
      return message.channel.send({ embeds: [embed] });
    }

    const { channel } = message.member.voice;
    if (!channel) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Voice Channel Required`,
        description: `${no} You must be connected to a voice channel.`
      });
      return message.reply({ embeds: [embed] });
    }

    if (message.member.voice.selfDeaf) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Cannot Run While Deafened`,
        description: `${no} <@${message.member.id}> You cannot run this command while deafened.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    const player = client.lavalink.players.get(message.guild.id);
    const { getQueueArray } = require("../../utils/queue.js");
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

    const guild = client.guilds.cache.get(message.guild.id);
    const voiceChannel = guild.channels.cache.get(player.voiceChannelId);
    const requestedRegion = Array.isArray(args) && args.length ? String(args[0]).toLowerCase() : null;

    let region = requestedRegion;
    if (region && !VALID_REGIONS.includes(region)) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Invalid Region`,
        description: `Use one of: \`${VALID_REGIONS.join("`, `")}\``
      });
      return message.channel.send({ embeds: [embed] });
    }

    if (!region) {
      region = VALID_REGIONS[Math.floor(Math.random() * VALID_REGIONS.length)];
    }

    try {
      await voiceChannel.edit({ rtcRegion: region }, "Fix command");
      const embed = createEmbed({
        title: `${getEmoji("success")} Region Updated`,
        description: `${ok} Voice region is now set to \`${region}\`.`
      });
      return message.channel.send({ embeds: [embed] });
    } catch (_e) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Update Failed`,
        description: "Unable to change region. Check my `MANAGE_CHANNELS` permission and try again."
      });
      return message.channel.send({ embeds: [embed] });
    }
  }
};

