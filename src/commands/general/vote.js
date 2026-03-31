const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const User = require("../../schema/User");
const { resolvePremiumAccess } = require("../../utils/premiumAccess");
const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "vote",
  category: "general",
  description: "Vote for Joker Music.",
  owner: false,
  wl: true,
  execute: async (message, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const botName = client.user?.username || "the bot";
    const voteUrl = `https://top.gg/bot/${client.user.id}/vote`;
    const vote = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Vote for ${botName}`).setURL(voteUrl);
    const voteEmoji = getEmoji("vote");
    try { if (voteEmoji) vote.setEmoji(voteEmoji); } catch (_e) {}
    const linkRow = new ActionRowBuilder().addComponents(vote);

    const premiumState = await resolvePremiumAccess(message.author.id, message.guild?.id, client).catch(() => null);
    const userData = await User.findOne({ userId: message.author.id }).lean().catch(() => null);

    const totalVotes = Number(userData?.totalVotes || 0);
    const hasActiveVoteAccess = Boolean(premiumState?.userPremium || premiumState?.topggFallbackVoted);
    const recoveryNote = premiumState?.topggVoteRecorded
      ? "A missed Top.gg vote was recovered automatically and counted for you."
      : null;
    const description = hasActiveVoteAccess
      ? [
          `Hey there! Looks like your Top.gg vote perks are already active for ${botName} :D`,
          `You can vote again any time by heading over to our [Top.gg](${voteUrl}) page - we'd really appreciate it!`,
          recoveryNote,
        ].filter(Boolean).join("\n")
      : [
          "Hey there! Looks like you haven't voted for the bot on Top.gg just yet :/",
          `You can vote and unlock some awesome perks by heading over to our [Top.gg](${voteUrl}) page - we'd really appreciate it!`,
        ].join("\n");

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({
        name: message.author.tag,
        iconURL: message.member?.displayAvatarURL({ forceStatic: false, size: 256 }) || message.author.displayAvatarURL({ forceStatic: false, size: 256 }),
      })
      .setDescription(description)
      .setFooter({
        text: `You have voted ${totalVotes} time(s) for ${botName} so far :D`,
        iconURL: client.user.displayAvatarURL({ forceStatic: false, size: 256 }),
      });

    return message.channel.send({ embeds: [embed], components: [linkRow] });
  }
};
