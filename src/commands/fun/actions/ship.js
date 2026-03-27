const { EmbedBuilder } = require("discord.js");
const { getActionGif } = require("../../../utils/actionGifProvider");
const { safeReply } = require("../../../utils/interactionResponder");

const romanceActions = ["kiss", "cuddle", "hug"];

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

function getShipUsers(ctx, args, client) {
  if (isInteraction(ctx)) {
    const user1 = ctx.options?.getUser?.("user1");
    const user2 = ctx.options?.getUser?.("user2");
    if (user1 && user2) return [user1, user2];
  }

  const users = ctx?.mentions?.users;
  if (users?.size >= 2) return Array.from(users.values()).slice(0, 2);

  const byId1 = args[0] ? client.users.cache.get(args[0]) : null;
  const byId2 = args[1] ? client.users.cache.get(args[1]) : null;
  if (byId1 && byId2) return [byId1, byId2];

  return [];
}

module.exports = {
  name: "ship",
  aliases: ["love", "relationship"],
  category: "fun",
  description: "Ship two users together!",
  usage: "ship @user1 @user2",
  execute: async (message, args, client) => {
    const users = getShipUsers(message, args, client);
    if (users.length < 2) return sendResponse(message, "Please mention two people to ship! ??");

    const user1 = users[0];
    const user2 = users[1];

    if (user1.id === user2.id) return sendResponse(message, "You can't ship someone with themselves! ??");

    const percentage = Math.floor(Math.random() * 100) + 1;
    let rating = "";

    if (percentage >= 80) rating = "A match made in heaven! ??????";
    else if (percentage >= 60) rating = "A pretty good match! ????";
    else if (percentage >= 40) rating = "Could work with some effort! ??";
    else if (percentage >= 20) rating = "Needs some work... ??";
    else rating = "Probably not meant to be... ??";

    const shipName = `${user1.username.slice(0, Math.ceil(user1.username.length / 2))}${user2.username.slice(Math.floor(user2.username.length / 2))}`;
    const romanceAction = romanceActions[Math.floor(Math.random() * romanceActions.length)];
    const randomGif = await getActionGif(romanceAction, "romance");

    const embed = new EmbedBuilder()
      .setColor("#ff1493")
      .setTitle(`? ${user1.username} + ${user2.username} ?`)
      .setDescription(`Ship Name: **${shipName}**`)
      .addFields(
        { name: "Compatibility", value: `${percentage}%`, inline: true },
        { name: "Rating", value: rating, inline: true }
      )
      .setThumbnail(user1.displayAvatarURL({ dynamic: true }))
      .setImage(randomGif);

    return sendResponse(message, { embeds: [embed] });
  }
};
