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
      lines.push(`${EMOJIS[key] || EMOJIS.star || "*"} ${label}`);
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
  description: "Shows your profile.",
  wl: true,
  run: async (client, interaction) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const createEmbed = ({ title, description, fields, author, thumbnail, image, footer, timestamp = false }) => {
      const embed = new EmbedBuilder().setColor(embedColor);
      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description);
      if (Array.isArray(fields) && fields.length > 0) embed.addFields(fields);
      if (author) embed.setAuthor(author);
      if (thumbnail) embed.setThumbnail(thumbnail);
      if (image) embed.setImage(image);
return embed;
    };
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    const member = interaction.member;
    let userData = await User.findOne({ userId: member.id });
    if (!userData) {
      userData = await User.create({ userId: member.id });
    }

    const badgeLines = getBadgeLines(client, userData);
    const badgeValue = badgeLines.join("\n");
    const premiumDoc = await Premium.findOne({ Id: member.id, Type: "user" });

    let premiumText = "No active premium subscription. Join support to get one.";
    if (premiumDoc?.Permanent) {
      premiumText = "Permanent subscription";
    } else if (premiumDoc && premiumDoc.Expire > Date.now()) {
      premiumText = `Valid for ${formatDuration(premiumDoc.Expire - Date.now(), { verbose: false }).replace(/\s\d+s$/, "")}`;
    } else if (premiumDoc) {
      const expiredAt = day(premiumDoc.Expire).format("DD/MM/YYYY");
      premiumText = `Expired on ${expiredAt}`;
      await premiumDoc.deleteOne();
    }

    const voted = client.topgg
      ? await client.topgg.hasVoted(member.id).catch(() => false)
      : false;
    const voteText = voted
      ? "Voted - premium commands unlocked for 12 hours."
      : "Not voted - vote on Top.gg to unlock premium commands for 12 hours.";

    const embed = createEmbed({
      title: `${getEmoji("users")} Profile - ${member.user.username}`,
      thumbnail: member.displayAvatarURL({ forceStatic: false, size: 1024 }),
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

    return interaction.editReply({ embeds: [embed] });
  }
};

