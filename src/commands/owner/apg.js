const { EmbedBuilder } = require("discord.js");

const day = require("dayjs");
const Premium = require("../../schema/Premium");
const formatDuration = require("../../utils/formatDuration");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "addpremium-guild",
  category: "owner",
  aliases: ["apg"],
  description: "Adds premium to a guild.",
  owneronly: true,
  execute: async (message, args, client, prefix) => {
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

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const guildId = args[0];
    const expiryInput = args[1];

    if (!guildId) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Missing Guild ID`,
        description: `${no} Usage: \`${prefix}apg <guild_id> [YYYY-MM-DD]\``
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (expiryInput && !day(expiryInput).isValid()) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Invalid Expiry Date`,
        description: `${no} Use date format: \`YYYY-MM-DD\``
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    const expireAt = expiryInput ? day(expiryInput).valueOf() : 0;
    const permanent = !expiryInput;

    const existing = await Premium.findOne({ Id: guildId, Type: "guild" });
    if (existing) {
      await existing.deleteOne();
    }

    await Premium.create({
      Id: guildId,
      Type: "guild",
      ActivatedAt: Date.now(),
      Expire: expireAt,
      Permanent: permanent,
      PlanType: "Standard"
    });

    const guildName = client.guilds.cache.get(guildId)?.name || guildId;
    const validity = permanent
      ? "Permanent"
      : formatDuration(Math.max(0, expireAt - Date.now()), { verbose: false }).replace(/\s\d+s$/, "");

    const embed = createEmbed({
      title: `${getEmoji("premium")} Guild Premium Added`,
      description: `${ok} Successfully added premium for **${guildName}**.`,
      fields: [
        statField("Guild ID", `\`${guildId}\``, "server"),
        statField("Plan", "`Standard`", "premium"),
        statField("Validity", `\`${validity}\``, "time")
      ]
    });

    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};

