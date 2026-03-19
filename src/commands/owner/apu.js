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
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const target = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);

    if (!target) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Invalid User`)
        .setDescription(`${no} Usage: \`${prefix}addpremium <@user|user_id>\``);
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

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("premium")} User Premium Added`)
      .setDescription(`${ok} Successfully added permanent premium to **${target.tag}**.`)
      .addFields(
        statField("User ID", `\`${target.id}\``, "users"),
        statField("Plan", "`Standard`", "premium"),
        statField("Validity", "`Permanent`", "time")
      );

    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};
