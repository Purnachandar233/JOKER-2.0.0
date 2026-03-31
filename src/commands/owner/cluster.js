const { EmbedBuilder } = require("discord.js");
const moment = require("moment");
const { safeReply } = require("../../utils/interactionResponder");

const EMOJIS = require("../../utils/emoji.json");

function isInteraction(ctx) {
  return Boolean(ctx && typeof ctx.deferReply === "function" && typeof ctx.editReply === "function");
}

async function sendResponse(ctx, payload) {
  if (isInteraction(ctx)) {
    const normalized = typeof payload === "string" ? { content: payload } : payload;
    return safeReply(ctx, normalized);
  }
  return ctx.channel.send(payload);
}

function resolveGuild(ctx) {
  return ctx?.guild || null;
}

function resolveAvatar(ctx) {
  try {
    if (ctx?.member?.user?.displayAvatarURL) return ctx.member.user.displayAvatarURL({ forceStatic: false });
  } catch (_e) {}
  try {
    if (ctx?.user?.displayAvatarURL) return ctx.user.displayAvatarURL({ forceStatic: false });
  } catch (_e) {}
  try {
    if (ctx?.author?.displayAvatarURL) return ctx.author.displayAvatarURL({ forceStatic: false });
  } catch (_e) {}
  return null;
}

module.exports = {
  name: "cluster",
  category: "general",
  description: "Shows the current cluster details.",
  owner: false,
  wl: true,
  execute: async (ctx, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const guild = resolveGuild(ctx);
    const guildName = guild?.name || "Cluster View";

    const mem = process.memoryUsage();
    const d = moment.duration(client.uptime);
    const uptime = `${d.days()}d ${d.hours()}h ${d.minutes()}m ${d.seconds()}s`;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({
        name: `${guildName} Cluster View`,
        iconURL: resolveAvatar(ctx)
      })
      .setDescription("Live shard and process telemetry for this node.")
      .addFields([
        statField("Servers", `\`${client.guilds.cache.size}\``, "server", true),
        statField("Users", `\`${client.users.cache.size}\``, "users", true),
        statField("Heap", `\`${Math.round(mem.heapUsed / 1024 / 1024)} / ${Math.round(mem.heapTotal / 1024 / 1024)} MB\``, "memory", true),
        statField("Uptime", `\`${uptime}\``, "time", true),
        statField("Ping", `\`${client.ws.ping}ms\``, "ping", true),
        statField("Shard", `\`${guild?.shardId ?? "N/A"}\``, "info", true)
      ])
      .setFooter({ text: "Joker Music" });

    return sendResponse(ctx, { embeds: [embed] });
  }
};
