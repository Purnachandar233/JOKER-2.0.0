const { EmbedBuilder } = require("discord.js");

const User = require("../../schema/User.js");
const day = require("dayjs");
const Premium = require("../../schema/Premium.js");
const formatDuration = require("../../utils/formatDuration");

const EMOJIS = require("../../utils/emoji.json");

function getBadgeLines(client, data) {
  const map = [
    ["owner", "Owner"],
    ["dev", "Verified Bot Developer"],
    ["supporter", "Supporter"],
    ["bug", "Bug Hunter"],
    ["premium", "Premium User"],
    ["manager", "Manager"],
    ["partner", "Partnered Member"],
    ["staff", "Staff Member"],
    ["booster", "Server Booster"]
  ];

  const lines = [];
  for (const [key, label] of map) {
    if (data?.badge?.[key]) {
      const icon = EMOJIS[key] || EMOJIS.star || "*";
      lines.push(`${icon} ${label}`);
    }
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

    const createEmbed = ({ title, description, fields, thumbnail }) => {
      const embed = new EmbedBuilder().setColor(embedColor);
      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description);
      if (fields?.length) embed.addFields(fields);
      if (thumbnail) embed.setThumbnail(thumbnail);
      return embed;
    };

    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]) ||
      message.member;

    let userData = await User.findOne({ userId: member.id });
    if (!userData) userData = await User.create({ userId: member.id });

    const badgeLines = getBadgeLines(client, userData);
    const badgeValue = badgeLines.join("\n");

    const premiumDoc = await Premium.findOne({ Id: member.id, Type: "user" });

    // ================= PREMIUM STATUS =================
    let premiumText = "No active premium subscription.";

    if (premiumDoc?.Permanent) {
      premiumText = "Permanent subscription";
    } else if (premiumDoc && premiumDoc.Expire > Date.now()) {
      premiumText = `Active for ${formatDuration(
        premiumDoc.Expire - Date.now(),
        { verbose: false }
      ).replace(/\s\d+s$/, "")}`;
    } else if (premiumDoc) {
      const expiredAt = day(premiumDoc.Expire).format("DD/MM/YYYY");
      premiumText = `Expired on ${expiredAt}`;
      await premiumDoc.deleteOne().catch(() => {});
    }

    // ================= VOTE STATUS (Webhook Based) =================
    let voteText = `Not voted - vote on [top.gg](https://top.gg/bot/${client.user.id}/vote) to unlock 12 hours premium.`;

    if (
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

    const embed = createEmbed({
      title: `${getEmoji("users")} Profile - ${member.user.username}`,
      thumbnail: member.displayAvatarURL({ size: 1024 }),
      fields: [
        statField("Commands Used", `\`${userData.count || 0}\``, "music"),
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
      ]
    });

    restoreBadgeFieldValue(embed, badgeValue);

    return message.channel.send({ embeds: [embed] });
  }
};