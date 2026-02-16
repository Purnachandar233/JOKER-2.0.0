const { EmbedBuilder } = require("discord.js");

const formatDuration = require("../../utils/formatDuration");
const redeemCode = require("../../schema/redemcode.js");
const Premium = require("../../schema/Premium.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "guild-redeem",
  category: "special",
  aliases: ["server-redeem"],
  wl: true,
  description: "Redeem premium code for this server",
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

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;

    const existing = await Premium.findOne({ Id: message.guild.id, Type: "guild" });
    if (existing && (existing.Permanent || existing.Expire > Date.now())) {
      const embed = createEmbed({
        title: `${getEmoji("premium")} Already Premium`,
        description: `${no} This server already has an active premium subscription.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    const code = args[0];
    if (!code) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Missing Code`,
        description: "Provide a redeem code."
      });
      return message.channel.send({ embeds: [embed] });
    }

    const record = await redeemCode.findOne({ Code: code });
    if (!record) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Invalid Code`,
        description: `${no} Code is invalid or expired.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    if (!record.Permanent && record.Expiry < Date.now()) {
      await record.deleteOne();
      const embed = createEmbed({
        title: `${getEmoji("error")} Expired Code`,
        description: `${no} This code has expired.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    if (existing) await existing.deleteOne();

    await Premium.create({
      Id: message.guild.id,
      Type: "guild",
      Code: code,
      ActivatedAt: Date.now(),
      Expire: record.Expiry || 0,
      Permanent: record.Permanent || false,
      PlanType: "Standard"
    });

    if (record.Usage <= 1) await record.deleteOne();
    else await redeemCode.findOneAndUpdate({ Code: code }, { Usage: record.Usage - 1 });

    const expiryText = record.Permanent ? "Never" : formatDuration(record.Expiry - Date.now());

    const embed = createEmbed({
      title: `${getEmoji("premium")} Premium Activated`,
      description: `${ok} Premium activated successfully.`,
      fields: [
        { name: "Server", value: `\`${message.guild.name}\``, inline: true },
        { name: "Expiry", value: `\`${expiryText}\``, inline: true }
      ]
    });

    return message.channel.send({ embeds: [embed] });
  }
};

