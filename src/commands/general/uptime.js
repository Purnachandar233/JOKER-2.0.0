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

function getMemberAvatar(ctx) {
  try {
    if (ctx?.member?.displayAvatarURL) {
      return ctx.member.displayAvatarURL({ forceStatic: false, size: 256 });
    }
  } catch (_e) {}

  try {
    if (ctx?.user?.displayAvatarURL) {
      return ctx.user.displayAvatarURL({ forceStatic: false, size: 256 });
    }
  } catch (_e) {}

  try {
    if (ctx?.author?.displayAvatarURL) {
      return ctx.author.displayAvatarURL({ forceStatic: false, size: 256 });
    }
  } catch (_e) {}

  return null;
}

module.exports = {
  name: "uptime",
  category: "general",
  description: "Shows the uptime of the bot.",
  owner: false,
  wl: true,
  execute: async (ctx, args, client) => {
    const d = moment.duration(client.uptime);
    const days = `${d.days()} day${d.days() === 1 ? "" : "s"}`;
    const hours = `${d.hours()} hour${d.hours() === 1 ? "" : "s"}`;
    const minutes = `${d.minutes()} minute${d.minutes() === 1 ? "" : "s"}`;
    const seconds = `${d.seconds()} second${d.seconds() === 1 ? "" : "s"}`;

    const embed = new EmbedBuilder()
      .setTitle(" Uptime")
      .setColor(client?.embedColor || "#ff0051")
      .setAuthor({ name: "uptime!", iconURL: getMemberAvatar(ctx) })
      .setDescription(`**${days}, ${hours}, ${minutes}, and ${seconds}**.`);

    return sendResponse(ctx, { embeds: [embed] });
  }
};
