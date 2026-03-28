const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const User = require("../../schema/User.js");
const { safeReply } = require("../../utils/interactionResponder");
const EMOJIS = require("../../utils/emoji.json");

const MANUAL_BADGES = [
  ["owner", "Owner"],
  ["dev", "Verified Bot Developer"],
  ["staff", "Staff Member"],
  ["manager", "Manager"],
  ["supporter", "Supporter"],
  ["partner", "Partnered Member"],
  ["booster", "Server Booster"],
  ["premium", "Premium User"],
  ["vip", "VIP"],
  ["bug", "Bug Hunter"],
];

function isInteraction(ctx) {
  return Boolean(ctx && typeof ctx.deferReply === "function" && typeof ctx.editReply === "function");
}

async function sendResponse(ctx, payload) {
  if (isInteraction(ctx)) {
    return safeReply(ctx, payload);
  }

  return ctx.channel.send(payload);
}

function getEmoji(key, fallback = "") {
  return EMOJIS[key] || fallback;
}

function buildRewardMap() {
  const rewardMap = new Map();

  for (const definition of Object.values(User.REWARD_CATALOG || {})) {
    if (!definition?.badgeKey) continue;
    rewardMap.set(definition.badgeKey, definition);
  }

  return rewardMap;
}

function getMetricUnit(metric) {
  if (metric === "votes") return "votes";
  if (metric === "songs") return "songs listened";
  if (metric === "commands") return "commands used";
  return "progress";
}

function buildMilestoneLines(metric, emojiKey) {
  const rewardMap = buildRewardMap();

  return Object.entries(User.BADGE_CATALOG || {})
    .filter(([, definition]) => definition?.metric === metric)
    .sort(([, a], [, b]) => Number(a?.threshold || 0) - Number(b?.threshold || 0))
    .map(([badgeKey, definition]) => {
      const reward = rewardMap.get(badgeKey);
      const icon = getEmoji(emojiKey, getEmoji("star", "*"));
      const perkLabel = reward?.label ? `Badge + ${reward.label}` : "Badge only";
      return `${icon} **${definition.label}** — ${definition.threshold} ${getMetricUnit(metric)} — ${perkLabel}`;
    });
}

function buildManualBadgeLines() {
  return MANUAL_BADGES.map(([key, label]) => {
    const icon = getEmoji(key, getEmoji("star", "*"));
    return `${icon} **${label}** — Staff or special recognition badge`;
  });
}

function buildBadgesPayload(client, ctx) {
  const embedColor = client?.embedColor || "#ff0051";
  const botName = client?.user?.username || "the bot";
  const voteUrl = `https://top.gg/bot/${client?.user?.id}/vote`;
  const premiumUrl = `https://top.gg/bot/${client?.user?.id}`;
  const supportUrl = client?.legalLinks?.supportServerUrl || "https://discord.gg/JQzBqgmwFm";

  const avatarURL =
    ctx?.member?.displayAvatarURL?.({ forceStatic: false, size: 256 }) ||
    ctx?.author?.displayAvatarURL?.({ forceStatic: false, size: 256 }) ||
    ctx?.user?.displayAvatarURL?.({ forceStatic: false, size: 256 }) ||
    client?.user?.displayAvatarURL?.({ forceStatic: false, size: 256 }) ||
    null;

  const voteButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel(`Vote for ${botName}`)
    .setURL(voteUrl);

  const premiumButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Premium Info")
    .setURL(premiumUrl);

  const supportButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Support")
    .setURL(supportUrl);

  try {
    const voteEmoji = getEmoji("vote");
    if (voteEmoji) voteButton.setEmoji(voteEmoji);
  } catch (_err) {}

  try {
    const premiumEmoji = getEmoji("premium");
    if (premiumEmoji) premiumButton.setEmoji(premiumEmoji);
  } catch (_err) {}

  try {
    const supportEmoji = getEmoji("support");
    if (supportEmoji) supportButton.setEmoji(supportEmoji);
  } catch (_err) {}

  const voteMilestones = buildMilestoneLines("votes", "vote");
  const songMilestones = buildMilestoneLines("songs", "songs");
  const commandMilestones = buildMilestoneLines("commands", "music");
  const manualBadges = buildManualBadgeLines();

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setAuthor({
      name: `${botName} Badges & Perks`,
      ...(avatarURL ? { iconURL: avatarURL } : {}),
    })
    .setDescription(
      [
        "See every badge, how it is earned, and what perks it gives.",
        "Use `=profile` or `/profile` to check which badges you already unlocked.",
      ].join("\n")
    )
    .addFields(
      {
        name: `${getEmoji("info", "i")} How It Works`,
        value: [
          "Automatic milestone badges unlock from votes, songs listened, and command usage.",
          "Special badges are manually awarded by the team for status, staff, support, or recognition.",
          "Vote milestone premium rewards are one-time unlocks and build up until permanent premium at 100 votes.",
        ].join("\n"),
        inline: false,
      },
      {
        name: `${getEmoji("vote", "*")} Vote Milestones`,
        value: voteMilestones.join("\n"),
        inline: false,
      },
      {
        name: `${getEmoji("songs", "*")} Listening Milestones`,
        value: songMilestones.join("\n"),
        inline: false,
      },
      {
        name: `${getEmoji("music", "*")} Command Milestones`,
        value: commandMilestones.join("\n"),
        inline: false,
      },
      {
        name: `${getEmoji("star", "*")} Special Badges`,
        value: manualBadges.join("\n"),
        inline: false,
      },
      {
        name: `${getEmoji("premium", "*")} Perks Summary`,
        value: [
          "Each normal Top.gg vote still gives **12 hours** of premium access.",
          "Vote milestone rewards: **5 votes = 7 days**, **10 = 15 days**, **25 = 1 month**, **50 = 6 months**, **100 = permanent**.",
          "Song and command milestones unlock badges only and do not grant premium access.",
        ].join("\n"),
        inline: false,
      }
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(voteButton, premiumButton, supportButton)],
  };
}

module.exports = {
  name: "badges",
  category: "general",
  aliases: ["badge", "perks"],
  description: "Shows all badges and their perks.",
  owner: false,
  wl: true,
  execute: async (ctx, args, client) => {
    const payload = buildBadgesPayload(client, ctx);
    return sendResponse(ctx, payload);
  },
};
