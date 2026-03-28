const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const User = require("../../schema/User");
const { resolvePremiumAccess } = require("../../utils/premiumAccess");
const { safeReply, safeDeferReply } = require("../../utils/interactionResponder");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "vote",
  description: "Vote for Joker Music",
  wl: true,
  run: async (client, interaction) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const botName = client.user?.username || "the bot";
    const voteUrl = `https://top.gg/bot/${client.user.id}/vote`;
    const vote = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Vote for ${botName}`).setURL(voteUrl);
    const voteEmoji = getEmoji("vote");
    try { if (voteEmoji) vote.setEmoji(voteEmoji); } catch (_e) {}
    const linkRow = new ActionRowBuilder().addComponents(vote);

    const [userData, premiumState] = await Promise.all([
      User.findOne({ userId: interaction.user.id }).lean().catch(() => null),
      resolvePremiumAccess(interaction.user.id, interaction.guildId, client).catch(() => null),
    ]);

    const totalVotes = Number(userData?.totalVotes || 0);
    const hasActiveVoteAccess = Boolean(premiumState?.userPremium || premiumState?.topggFallbackVoted);
    const description = hasActiveVoteAccess
      ? [
          `Hey there! Looks like your Top.gg vote perks are already active for ${botName} :D`,
          `You can vote again any time by heading over to our [Top.gg](${voteUrl}) page - we'd really appreciate it!`,
        ].join("\n")
      : [
          "Hey there! Looks like you haven't voted for the bot on Top.gg just yet :/",
          `You can vote and unlock some awesome perks by heading over to our [Top.gg](${voteUrl}) page - we'd really appreciate it!`,
        ].join("\n");

    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: "Failed to defer reply." });

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.member?.displayAvatarURL?.({ forceStatic: false, size: 256 }) || interaction.user.displayAvatarURL({ forceStatic: false, size: 256 }),
      })
      .setDescription(description)
      .setFooter({
        text: `You have voted ${totalVotes} time(s) for ${botName} so far :D`,
        iconURL: client.user.displayAvatarURL({ forceStatic: false, size: 256 }),
      });

    return safeReply(interaction, { embeds: [embed], components: [linkRow] });
  }
};
