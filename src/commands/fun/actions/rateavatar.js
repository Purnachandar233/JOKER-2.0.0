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

function getFirstMentionedUser(ctx, args, client, author) {
  if (isInteraction(ctx)) {
    const optionUser = ctx.options?.getUser?.("user");
    if (optionUser) return optionUser;
  }

  const users = ctx?.mentions?.users;
  if (users?.first) return users.first() || (args[0] ? client.users.cache.get(args[0]) : null) || author;
  if (users instanceof Map) return users.values().next().value || (args[0] ? client.users.cache.get(args[0]) : null) || author;
  return (args[0] ? client.users.cache.get(args[0]) : null) || author;
}

module.exports = {
  name: "rateavatar",
  aliases: ["avatarrate", "avgr", "arate"],
  category: "fun",
  description: "Rate someone's avatar!",
  usage: "rateavatar @user",
  execute: async (message, args, client) => {
    const author = getAuthor(message);
    if (!author) return sendResponse(message, "Unable to resolve command user.");

    const user = getFirstMentionedUser(message, args, client, author);
    if (!user) return sendResponse(message, "Please mention a valid user or provide their ID!");

    const rating = Math.floor(Math.random() * 41) + 60;
    const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 512 });

    let feedback = "";
    if (rating >= 90) feedback = "Absolutely stunning! That's a masterpiece! ??";
    else if (rating >= 80) feedback = "Looking great! Very professional and attractive! ??";
    else if (rating >= 70) feedback = "Nice avatar! Pretty cool choice! ??";
    else feedback = "Not bad at all! Shows good taste! ??";

    const reactionGif = await getActionGif("happy");
    const embed = new EmbedBuilder()
      .setColor("#ffb6c1")
      .setTitle(`Avatar Rating for ${user.username}`)
      .setDescription(feedback)
      .addFields({ name: "Overall Rating", value: `**${rating}/100** ${"?".repeat(Math.floor(rating / 20))}`, inline: false })
      .setThumbnail(avatarUrl)
      .setImage(reactionGif);

    return sendResponse(message, { embeds: [embed] });
  }
};
