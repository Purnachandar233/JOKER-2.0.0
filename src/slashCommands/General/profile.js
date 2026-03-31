const { EmbedBuilder } = require("discord.js");

const User = require("../../schema/User.js");
const day = require("dayjs");
const formatDuration = require("../../utils/formatDuration");
const { resolvePremiumAccess } = require("../../utils/premiumAccess");

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
      lines.push(`${EMOJIS[key] || EMOJIS.star || "*"} ${label}`);
    }
  }

  for (const { definition } of getTopMilestonesByMetric(data)) {
    let icon = EMOJIS.star || "*";
    if (definition.metric === "votes") icon = EMOJIS.vote || EMOJIS.star || "*";
    if (definition.metric === "songs") icon = EMOJIS.songs || EMOJIS.music || EMOJIS.star || "*";
    if (definition.metric === "commands") icon = EMOJIS.music || EMOJIS.star || "*";

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
  description: "Shows your profile.",
  wl: true,
  run: async (client, interaction) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    const member =
      interaction.guild?.members?.cache?.get?.(interaction.user.id) ||
      interaction.member ||
      null;
    const profileUser = member?.user || interaction.user;
    const profileUserId = member?.id || profileUser?.id || interaction.user.id;
    const avatarUrl =
      member?.displayAvatarURL?.({ forceStatic: false, size: 1024 }) ||
      profileUser?.displayAvatarURL?.({ forceStatic: false, size: 1024 }) ||
      null;

    const access = await resolvePremiumAccess(profileUserId, interaction.guild?.id, client).catch(() => null);

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

    let premiumText = "No active premium access.";
    if (access?.userPremium && premiumDoc?.Permanent) {
      premiumText = "Permanent access";
    } else if (access?.userPremium && premiumDoc && premiumDoc.Expire > Date.now()) {
      premiumText = `Valid for ${formatDuration(premiumDoc.Expire - Date.now(), { verbose: false }).replace(/\s\d+s$/, "")}`;
    } else if (access?.topggFallbackVoted) {
      premiumText = "Active via Top.gg vote window";
    } else if (premiumDoc) {
      const expiredAt = day(premiumDoc.Expire).format("DD/MM/YYYY");
      premiumText = `Expired on ${expiredAt}`;
      await premiumDoc.deleteOne().catch(() => {});
    }

    let voteText = `Not voted - vote on [top.gg](https://top.gg/bot/${client.user.id}/vote) to unlock premium commands for 12 hours.`;
    if (access?.topggVoteRecorded) {
      voteText = "Voted - Premium active and the vote was recovered automatically.";
    } else if (access?.topggFallbackVoted) {
      voteText = "Voted - Premium active via automatic Top.gg recovery.";
    } else if (premiumDoc && !premiumDoc.Permanent && premiumDoc.Expire > Date.now()) {
      voteText = `Voted - premium commands unlocked for ${formatDuration(
        premiumDoc.Expire - Date.now(),
        { verbose: false }
      ).replace(/\s\d+s$/, "")}.`;
    }

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("users")} Profile - ${profileUser?.username || "User"}`)
      .addFields(
        statField("Commands Used", `\`${userData.count || 0}\``, "music"),
        statField("Total Votes", `\`${userData.totalVotes || 0}\``, "vote"),
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
        }
      );
    if (avatarUrl) embed.setThumbnail(avatarUrl);
    restoreBadgeFieldValue(embed, badgeValue);

    return interaction.editReply({ embeds: [embed] });
  }
};
