const { EmbedBuilder } = require("discord.js");
const EMOJIS = require("../../utils/emoji.json");
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

function hasManageRoles(ctx) {
  return Boolean(
    ctx?.member?.permissions?.has?.("ManageRoles") ||
    ctx?.member?.permissions?.has?.("MANAGE_ROLES") ||
    ctx?.member?.permissions?.has?.("Administrator") ||
    ctx?.member?.permissions?.has?.("ADMINISTRATOR")
  );
}

function resolveRole(ctx, args, client) {
  if (isInteraction(ctx)) {
    return ctx.options?.getRole?.("role") || null;
  }

  const mentionedRole = ctx?.mentions?.roles?.first?.();
  if (mentionedRole) return mentionedRole;
  const roleId = args?.[0] ? String(args[0]).replace(/[<@&>]/g, "") : null;
  if (!roleId) return null;
  return ctx.guild?.roles?.cache?.get?.(roleId) || client?.guilds?.cache?.get?.(ctx.guild?.id)?.roles?.cache?.get?.(roleId) || null;
}

module.exports = {
  name: "setdj",
  category: "settings",
  description: "Toggles djrole mode",
  owneronly: false,
  wl: true,
  execute: async (ctx, args, client) => {
    const no = EMOJIS.no;

    if (!ctx?.guild?.id) {
      return sendResponse(ctx, { content: "This command can only be used in a server." });
    }

    if (!hasManageRoles(ctx)) {
      const noperms = new EmbedBuilder()
        .setColor(client?.embedColor || "#ff0051")
        .setDescription(`${no} You need this required Permissions: \`MANAGE_ROLES\` to run this command.`);
      return sendResponse(ctx, { embeds: [noperms] });
    }

    const role = resolveRole(ctx, args, client);
    if (!role) {
      const embed = new EmbedBuilder()
        .setColor(client?.embedColor || "#ff0051")
        .setDescription(`${no} Please provide a role to set as the DJ role.`);
      return sendResponse(ctx, { embeds: [embed] });
    }

    const dSchema = require("../../schema/djroleSchema.js");
    try {
      await dSchema.findOneAndUpdate(
        { guildID: ctx.guild.id },
        { $set: { Roleid: role.id } },
        { upsert: true, returnDocument: "after" }
      );
    } catch (err) {
      try { client.logger?.log(err && (err.stack || err.toString()), "error"); } catch (_e) {}
    }

    const embed = new EmbedBuilder()
      .setColor(client?.embedColor || "#ff0051")
      .setDescription(`DJ role mode is now **enabled** and set to ${role}.`);
    return sendResponse(ctx, { embeds: [embed] });
  }
};
