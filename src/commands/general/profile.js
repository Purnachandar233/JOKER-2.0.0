const { EmbedBuilder } = require("discord.js");

const User = require("../../schema/User.js");
const day = require("dayjs");
const formatDuration = require("../../utils/formatDuration.js");
const { resolvePremiumAccess } = require("../../utils/premiumAccess.js");

const EMOJIS = require("../../utils/emoji.json");

function getTopMilestonesByMetric(data) {
  const milestoneMap = User.BADGE_CATALOG || {};
  const bestByMetric = new Map();

  for (const [key, definition] of Object.entries(milestoneMap)) {
    if (!data?.milestones?.[key]) continue;

    const metric = String(definition?.metric || "").trim().toLowerCase();
    if (!metric) continue;

    const currentBest = bestByMetric.get(metric);
    const threshold = Number(definition?.threshold || 0);
    const bestThreshold = Number(currentBest?.definition?.threshold || 0);

    if (!currentBest || threshold > bestThreshold) {
      bestByMetric.set(metric, { key, definition });
    }
  }

  const metricOrder = ["votes", "songs", "commands"];
  return [...bestByMetric.entries()]
    .sort((a, b) => metricOrder.indexOf(a[0]) - metricOrder.indexOf(b[0]))
    .map((entry) => entry[1]);
}

function getBadgeLines(client, data) {
  const manualMap = [
    ["owner", "Owner"],
    ["dev", "Verified Bot Developer"],
    ["supporter", "Supporter"],
    ["bug", "Bug Hunter"],
    ["premium", "Premium User"],
    ["manager", "Manager"],
    ["partner", "Partnered Member"],
    ["staff", "Staff Member"],
    ["booster", "Server Booster"],
    ["vip", "VIP"]
  ];

  const lines = [];
  for (const [key, label] of manualMap) {
    if (data?.badge?.[key]) {
      const icon = EMOJIS[key] || EMOJIS.star || "*";
      lines.push(`${icon} ${label}`);
    }
  }

  for (const { definition } of getTopMilestonesByMetric(data)) {
    let icon = EMOJIS.star || "*";
    if (definition.metric === "votes") icon = EMOJIS.vote || EMOJIS.star || "*";
    if (definition.metric === "songs") icon = EMOJIS.songs || EMOJIS.music || EMOJIS.star || "*";
    if (definition.metric === "commands") icon = EMOJIS.users || EMOJIS.star || "*";

    lines.push(`${icon} ${definition.label}`);
  }

  if (lines.length === 0) {
    lines.push("No achievements unlocked yet.");
  }

  return lines;
}

function restoreBadgeFieldValue(embed, badgeValue) {
  const fields = embed?.data?.fields;
  if (!Array.isArray(fields)) return;

  const field = fields.find(entry =>
    typeof entry?.name === "string" && entry.name.toLowerCase().includes("achievements")
  );
  if (field) field.value = badgeValue;
}

module.exports = {
  name: "profile",
  category: "special",
  description: "Shows your profile or another member profile.",
  owneronly: false,
  wl: true,
  execute: async (message, args, client) => {

    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";

    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]) ||
      await message.guild.members.fetch(args[0]).catch(() => null) ||
      message.member;

    const profileMember = member || message.member;
    const profileUser = profileMember?.user || message.author;
    const profileUserId = profileMember?.id || profileUser?.id || message.author.id;
    const profileAvatarUrl =
      profileMember?.displayAvatarURL?.({ forceStatic: false, size: 1024 }) ||
      profileUser?.displayAvatarURL?.({ forceStatic: false, size: 1024 }) ||
      null;

    const access = await resolvePremiumAccess(profileUserId, message.guild?.id, client).catch(() => null);

    let userData = await User.findOne({ userId: profileUserId }).lean();
    if (!userData) {
      userData = {
        userId: profileUserId,
        count: 0,
        totalVotes: 0,
        songsListened: 0,
        totalListenTimeMs: 0,
        badge: {},
        milestones: {}
      };
    }

    const badgeLines = getBadgeLines(client, userData);
    const badgeValue = badgeLines.join("\n");
    const totalListenTime = formatDuration(userData.totalListenTimeMs || 0, {
      verbose: false,
      unitCount: 3
    });

    const premiumDoc = access?.userDoc || null;

    // ================= PREMIUM STATUS =================
    let premiumText = "No active premium access.";

    if (access?.userPremium && premiumDoc?.Permanent) {
      premiumText = "Permanent access";
    } else if (access?.userPremium && premiumDoc && premiumDoc.Expire > Date.now()) {
      premiumText = `Active for ${formatDuration(
        premiumDoc.Expire - Date.now(),
        { verbose: false }
      ).replace(/\s\d+s$/, "")}`;
    } else if (access?.topggFallbackVoted) {
      premiumText = "Active via Top.gg vote window";
    } else if (premiumDoc) {
      const expiredAt = day(premiumDoc.Expire).format("DD/MM/YYYY");
      premiumText = `Expired on ${expiredAt}`;
      await premiumDoc.deleteOne().catch(() => {});
    }

    // ================= VOTE STATUS (Webhook Based) =================
    let voteText = `Not voted - vote on [top.gg](https://top.gg/bot/${client.user.id}/vote) to unlock 12 hours premium.`;

    if (access?.topggVoteRecorded) {
      voteText = "Voted - Premium active and the vote was recovered automatically.";
    } else if (access?.topggFallbackVoted) {
      voteText = "Voted - Premium active via automatic Top.gg recovery.";
    } else if (
      premiumDoc &&
      !premiumDoc.Permanent &&
      premiumDoc.Expire > Date.now()
    ) {
      const remaining = premiumDoc.Expire - Date.now();
      voteText = `Voted - Premium active for ${formatDuration(
        remaining,
        { verbose: false }
      ).replace(/\s\d+s$/, "")}.`;
    }

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({
        name: `Profile - ${profileUser?.username || "User"}`,
        ...(profileUser?.displayAvatarURL ? { iconURL: profileUser.displayAvatarURL({ forceStatic: false }) } : {}),
      })
      .addFields(
        statField("Commands Used", `\`${userData.count || 0}\``, "users"),
        statField("Songs Listened", `\`${userData.songsListened || 0}\``, "songs"),
        statField("Listen Time", `\`${totalListenTime}\``, "time"),
        {
          name: `${getEmoji("star")} Achievements`,
          value: badgeValue,
          inline: false
        },
        {
          name: `${getEmoji("premium")} Premium Status`,
          value: premiumText,
          inline: false
        },
        {
          name: `${getEmoji("vote")} Vote Status`,
          value: voteText,
          inline: false
        },
        {
          name: "Total Votes",
          value: `\`${userData.totalVotes || 0}\``,
          inline: false
        }
      );

    if (profileAvatarUrl) {
      embed.setThumbnail(profileAvatarUrl);
    }

    restoreBadgeFieldValue(embed, badgeValue);

    return message.channel.send({ embeds: [embed] });
  }
};
