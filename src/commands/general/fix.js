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

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;

    if (!message.member.permissions.has("MANAGE_CHANNELS")) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Missing Permission`)
        .setDescription("You need `MANAGE_CHANNELS` to run this command.");
      return message.channel.send({ embeds: [embed] });
    }

    const { channel } = message.member.voice;
    if (!channel) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Voice Channel Required`)
        .setDescription(`${no} You must be connected to a voice channel.`);
      return message.reply({ embeds: [embed] });
    }

    if (message.member.voice.selfDeaf) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({name: 'Cant run while deafened', iconURL: client.user.displayAvatarURL()})
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`);
      return message.channel.send({ embeds: [embed] });
    }

    const player = client.lavalink.players.get(message.guild.id);
    const { getQueueArray } = require("../../utils/queue.js");
    const tracks = getQueueArray(player);

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

    const guild = client.guilds.cache.get(message.guild.id);
    const voiceChannel = guild.channels.cache.get(player.voiceChannelId);
    const requestedRegion = Array.isArray(args) && args.length ? String(args[0]).toLowerCase() : null;

    let region = requestedRegion;
    if (region && !VALID_REGIONS.includes(region)) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Invalid Region`)
        .setDescription(`Use one of: \`${VALID_REGIONS.join("`, `")}\``);
      return message.channel.send({ embeds: [embed] });
    }

    if (!region) {
      region = VALID_REGIONS[Math.floor(Math.random() * VALID_REGIONS.length)];
    }

    try {
      await voiceChannel.edit({ rtcRegion: region }, "Fix command");
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Region Updated`)
        .setDescription(`${ok} Voice region is now set to \`${region}\`.`);
      return message.channel.send({ embeds: [embed] });
    } catch (_e) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Update Failed`)
        .setDescription("Unable to change region. Check my `MANAGE_CHANNELS` permission and try again.");
      return message.channel.send({ embeds: [embed] });
    }
  }
};
