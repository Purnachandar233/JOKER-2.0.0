const { EmbedBuilder } = require("discord.js");

const Premium = require("../../schema/Premium.js");
const redeemCode = require("../../schema/redemcode.js");
const formatDuration = require("../../utils/formatDuration");

const EMOJIS = require("../../utils/emoji.json");
function formatValidity(premiumDoc) {
  if (premiumDoc.Permanent) return "Permanent";
  return formatDuration(Math.max(0, premiumDoc.Expire - Date.now()), { verbose: false }).replace(/\s\d+s$/, "");
}

function clampField(text, fallback = "None") {
  const value = (text && text.trim()) ? text : fallback;
  return value.length > 1024 ? `${value.slice(0, 1021)}...` : value;
}

module.exports = {
  name: "dashboard",
  category: "owner",
  aliases: ["db", "premiumdashboard", "pdashboard"],
  description: "Shows premium dashboard data.",
  owneronly: true,
  execute: async (message, args, client) => {
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

    const guildPremiumDocs = await Premium.find({ Type: "guild" });
    const userPremiumDocs = await Premium.find({ Type: "user" });
    const codeDocs = await redeemCode.find({
      $or: [{ Permanent: true }, { Expiry: { $gt: Date.now() } }]
    });

    const activeGuilds = guildPremiumDocs.filter(doc => doc.Permanent || doc.Expire > Date.now());
    const activeUsers = userPremiumDocs.filter(doc => doc.Permanent || doc.Expire > Date.now());

    const guildList = activeGuilds
      .slice(0, 8)
      .map(doc => {
        const guild = client.guilds.cache.get(doc.Id);
        const guildName = guild?.name || "Unknown Guild";
        return `• ${guildName} (\`${doc.Id}\`) - ${formatValidity(doc)}`;
      })
      .join("\n");

    const userList = activeUsers
      .slice(0, 8)
      .map(doc => {
        const user = client.users.cache.get(doc.Id);
        const userTag = user?.tag || "Unknown User";
        return `• ${userTag} (\`${doc.Id}\`) - ${formatValidity(doc)}`;
      })
      .join("\n");

    const codeList = codeDocs
      .slice(0, 8)
      .map(doc => {
        const validity = doc.Permanent
          ? "Permanent"
          : formatDuration(Math.max(0, doc.Expiry - Date.now()), { verbose: false }).replace(/\s\d+s$/, "");
        return `• \`${doc.Code}\` - ${validity} - uses: ${doc.Usage}`;
      })
      .join("\n");

    const embed = createEmbed({
      title: `${getEmoji("premium")} Premium Dashboard`,
      description: "Live overview of premium users, premium guilds, and redeem codes.",
      fields: [
        statField("Active Premium Guilds", `\`${activeGuilds.length}\``, "server"),
        statField("Active Premium Users", `\`${activeUsers.length}\``, "users"),
        statField("Active Codes", `\`${codeDocs.length}\``, "premium"),
        {
          name: `${getEmoji("server")} Guild Preview`,
          value: clampField(guildList),
          inline: false
        },
        {
          name: `${getEmoji("users")} User Preview`,
          value: clampField(userList),
          inline: false
        },
        {
          name: `${getEmoji("premium")} Code Preview`,
          value: clampField(codeList),
          inline: false
        }
      ]
    });

    return message.channel.send({ embeds: [embed] });
  }
};

