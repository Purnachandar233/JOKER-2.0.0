const { EmbedBuilder } = require("discord.js");
const db = require("../../schema/prefix.js");
const { safeReply } = require("../../utils/interactionResponder");

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

function hasManageGuildPermission(ctx) {
  return Boolean(
    ctx?.member?.permissions?.has?.("ManageGuild") ||
    ctx?.member?.permissions?.has?.("MANAGE_GUILD") ||
    ctx?.member?.permissions?.has?.("Administrator") ||
    ctx?.member?.permissions?.has?.("ADMINISTRATOR")
  );
}

module.exports = {
  name: "setprefix",
  category: "Settings",
  description: "Set Custom Prefix",
  args: false,
  usage: "<prefix>",
  aliases: ["prefix"],
  owner: false,
  wl: true,
  execute: async (ctx, args, client, prefix) => {
    if (!ctx?.guild?.id) {
      return sendResponse(ctx, { content: "This command can only be used in a server." });
    }

    if (!hasManageGuildPermission(ctx)) {
      const noperms = new EmbedBuilder()
        .setColor(client?.embedColor || "#ff0051")
        .setDescription("*You need the `Manage Server` or `Administrator` permission to change the prefix.*");
      return sendResponse(ctx, { embeds: [noperms] });
    }

    const interactionPrefix = isInteraction(ctx) ? ctx.options?.getString?.("prefix") : null;
    const pre = interactionPrefix || args?.[0];

    if (!pre) {
      const embed = new EmbedBuilder()
        .setDescription("*Please provide the prefix you wish to set.*")
        .setColor(client?.embedColor || "#ff0051");
      return sendResponse(ctx, { embeds: [embed] });
    }

    if (pre.length > 5) {
      const embed = new EmbedBuilder()
        .setDescription("*The prefix must be 5 characters or less.*")
        .setColor(client?.embedColor || "#ff0051");
      return sendResponse(ctx, { embeds: [embed] });
    }

    const data = await db.findOne({ Guild: ctx.guild.id });
    if (data) {
      data.oldPrefix = prefix;
      data.Prefix = pre;
      await data.save();
    } else {
      await new db({
        Guild: ctx.guild.id,
        Prefix: pre,
        oldPrefix: prefix
      }).save();
    }

    const success = new EmbedBuilder()
      .setDescription(`✧ The prefix for this server has been updated to **${pre}**`)
      .setColor(client?.embedColor || "#ff0051");
    return sendResponse(ctx, { embeds: [success] });
  }
};
