const { EmbedBuilder } = require("discord.js");

const os = require("os");
const formatDuration = require("../../utils/formatDuration");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "server-stats",
  category: "owner",
  description: "Shows host stats for the bot process.",
  owneronly: true,
  execute: async (message, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const cpu = os.cpus()[0];
    const uptime = formatDuration(os.uptime() * 1000, { verbose: false, unitCount: 4 });
    const processMemMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMb = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("server")} Host Statistics`)
      .setDescription("Runtime and machine diagnostics for this process.")
      .addFields(
        statField("Host", `\`${os.type()} ${os.arch()}\``, "server"),
        statField("Node", `\`${process.version}\``, "info"),
        statField("Uptime", `\`${uptime}\``, "time"),
        statField("CPU Model", `\`${cpu?.model || "Unknown"}\``, "server", false),
        statField("CPU Cores", `\`${os.cpus().length}\``, "server"),
        statField("CPU Speed", `\`${cpu?.speed || 0}MHz\``, "server"),
        statField("Load (1m)", `\`${os.loadavg()[0].toFixed(2)}\``, "server"),
        statField("RAM Total", `\`${Math.round(os.totalmem() / 1024 / 1024)}MB\``, "memory"),
        statField("RAM Free", `\`${Math.round(os.freemem() / 1024 / 1024)}MB\``, "memory"),
        statField("Heap Used", `\`${processMemMb}MB\``, "memory"),
        statField("Heap Total", `\`${heapTotalMb}MB\``, "memory")
      );

    return message.channel.send({ embeds: [embed] });
  }
};
