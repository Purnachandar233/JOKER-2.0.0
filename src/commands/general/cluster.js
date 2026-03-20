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
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const mem = process.memoryUsage();
    const d = moment.duration(client.uptime);
    const uptime = `${d.days()}d ${d.hours()}h ${d.minutes()}m ${d.seconds()}s`;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({
        name: `${message.guild.name} Cluster View`,
        iconURL: message.member.user.displayAvatarURL({ forceStatic: false })
      })
      .setDescription("Live shard and process telemetry for this node.")
      .setAuthor({
        name: `${message.guild.name} Cluster View`,
        iconURL: message.member.user.displayAvatarURL({ forceStatic: false })
      })
      .addFields([
        statField("Servers", `\`${client.guilds.cache.size}\``, "server", true),
        statField("Users", `\`${client.users.cache.size}\``, "users", true),
        statField("Heap", `\`${Math.round(mem.heapUsed / 1024 / 1024)} / ${Math.round(mem.heapTotal / 1024 / 1024)} MB\``, "memory", true),
        statField("Uptime", `\`${uptime}\``, "time", true),
        statField("Ping", `\`${client.ws.ping}ms\``, "ping", true),
        statField("Shard", `\`${message.guild.shardId}\``, "info", true)
      ])
      .setFooter({ text: `Joker Music` });

    return message.channel.send({ embeds: [embed] });
  }
};
