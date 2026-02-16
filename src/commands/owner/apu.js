const { EmbedBuilder } = require("discord.js");

const Premium = require("../../schema/Premium");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "addpremium",
  category: "owner",
  aliases: ["ap", "addprem"],
  description: "Adds permanent premium to a user.",
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
    const target = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);

    if (!target) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Invalid User`,
        description: `${no} Usage: \`${prefix}addpremium <@user|user_id>\``
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    const existing = await Premium.findOne({ Id: target.id, Type: "user" });
    if (existing) {
      await existing.deleteOne();
    }

    await Premium.create({
      Id: target.id,
      Type: "user",
      ActivatedAt: Date.now(),
      Expire: 0,
      Permanent: true,
      PlanType: "Standard"
    });

    const embed = createEmbed({
      title: `${getEmoji("premium")} User Premium Added`,
      description: `${ok} Successfully added permanent premium to **${target.tag}**.`,
      fields: [
        statField("User ID", `\`${target.id}\``, "users"),
        statField("Plan", "`Standard`", "premium"),
        statField("Validity", "`Permanent`", "time")
      ]
    });

    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};

