const { EmbedBuilder } = require("discord.js");
const { getActionGif } = require("../../../utils/actionGifProvider");
const { safeReply } = require("../../../utils/interactionResponder");

function isInteraction(ctx) {
  return Boolean(ctx && typeof ctx.deferReply === "function" && typeof ctx.editReply === "function");
}

function getAuthor(ctx) {
  return ctx?.author || ctx?.user || null;
}

async function sendResponse(ctx, payload) {
  if (isInteraction(ctx)) {
    const normalized = typeof payload === "string" ? { content: payload } : payload;
    return safeReply(ctx, normalized);
  }
  return ctx.channel.send(payload);
}

function getFirstMentionedUser(ctx, args, client) {
  if (isInteraction(ctx)) {
    const optionUser = ctx.options?.getUser?.("user");
    if (optionUser) return optionUser;
  }

  const users = ctx?.mentions?.users;
  if (users?.first) return users.first() || (args[0] ? client.users.cache.get(args[0]) : null);
  if (users instanceof Map) return users.values().next().value || (args[0] ? client.users.cache.get(args[0]) : null);
  return args[0] ? client.users.cache.get(args[0]) : null;
}

module.exports = {
  name: "kiss",
  aliases: ["smooch", "kisses", "ummah"],
  category: "fun",
  description: "Give someone a sweet kiss!",
  usage: "kiss @user",
  execute: async (message, args, client) => {
    const author = getAuthor(message);
    const user = getFirstMentionedUser(message, args, client);

    if (!user) return sendResponse(message, "Please mention someone to kiss! ??");
    if (!author) return sendResponse(message, "Unable to resolve command user.");
    if (user.id === author.id) return sendResponse(message, "You can't kiss yourself! ??");

    const randomGif = await getActionGif("kiss");
    const embed = new EmbedBuilder()
      .setColor("#ff1493")
      .setDescription(`${author.username} gives ${user.username} a sweet kiss! ??`)
      .setImage(randomGif);

    return sendResponse(message, { embeds: [embed] });
  }
};
