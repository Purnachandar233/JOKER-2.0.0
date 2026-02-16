const { EmbedBuilder } = require("discord.js");

const moment = require("moment");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "cluster",
  category: "general",
  description: "Shows the current cluster details.",
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

    const mem = process.memoryUsage();
    const d = moment.duration(client.uptime);
    const uptime = `${d.days()}d ${d.hours()}h ${d.minutes()}m ${d.seconds()}s`;

    const embed = createEmbed({
      title: `${getEmoji("spark")} Cluster Runtime` ,
      description: "Live shard and process telemetry for this node.",
      author: {
        name: `${message.guild.name} Cluster View`,
        iconURL: message.member.user.displayAvatarURL({ forceStatic: false })
      },
      fields: [
        statField("Servers", `\`${client.guilds.cache.size}\``, "server", true),
        statField("Users", `\`${client.users.cache.size}\``, "users", true),
        statField("Heap", `\`${Math.round(mem.heapUsed / 1024 / 1024)} / ${Math.round(mem.heapTotal / 1024 / 1024)} MB\``, "memory", true),
        statField("Uptime", `\`${uptime}\``, "time", true),
        statField("Ping", `\`${client.ws.ping}ms\``, "ping", true),
        statField("Shard", `\`${message.guild.shardId}\``, "info", true)
      ],
      footer: `${getEmoji("music")} Joker Music | Cluster Diagnostics`
    });

    return message.channel.send({ embeds: [embed] });
  }
};

