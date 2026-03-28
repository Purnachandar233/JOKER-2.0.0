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
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Missing Guild ID`)
        .setDescription(`${no} Usage: \`${prefix}apg <guild_id> [YYYY-MM-DD]\``);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (expiryInput && !day(expiryInput).isValid()) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Invalid Expiry Date`)
        .setDescription(`${no} Use date format: \`YYYY-MM-DD\``);
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
      ActivatedBy: message.author?.id || null,
      ActivatedAt: Date.now(),
      Expire: expireAt,
      Permanent: permanent,
      PlanType: "Standard"
    });

    const guildName = client.guilds.cache.get(guildId)?.name || guildId;
    const validity = permanent
      ? "Permanent"
      : formatDuration(Math.max(0, expireAt - Date.now()), { verbose: false }).replace(/\s\d+s$/, "");

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("premium")} Guild Premium Added`)
      .setDescription(`${ok} Successfully added premium for **${guildName}**.`)
      .addFields(
        statField("Guild ID", `\`${guildId}\``, "server"),
        statField("Plan", "`Standard`", "premium"),
        statField("Validity", `\`${validity}\``, "time")
      );

    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};
