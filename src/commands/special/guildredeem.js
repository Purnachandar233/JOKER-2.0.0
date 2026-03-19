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

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;

    const existing = await Premium.findOne({ Id: message.guild.id, Type: "guild" });
    if (existing && (existing.Permanent || existing.Expire > Date.now())) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("premium")} Already Premium`)
        .setDescription(`${no} This server already has an active premium subscription.`);
      return message.channel.send({ embeds: [embed] });
    }

    const code = args[0];
    if (!code) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Missing Code`)
        .setDescription("Provide a redeem code.");
      return message.channel.send({ embeds: [embed] });
    }

    const record = await redeemCode.findOne({ Code: code });
    if (!record) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Invalid Code`)
        .setDescription(`${no} Code is invalid or expired.`);
      return message.channel.send({ embeds: [embed] });
    }

    if (!record.Permanent && record.Expiry < Date.now()) {
      await record.deleteOne();
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Expired Code`)
        .setDescription(`${no} This code has expired.`);
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

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("premium")} Premium Activated`)
      .setDescription(`${ok} Premium activated successfully.`)
      .addFields(
        { name: "Server", value: `\`${message.guild.name}\``, inline: true },
        { name: "Expiry", value: `\`${expiryText}\``, inline: true }
      );

    return message.channel.send({ embeds: [embed] });
  }
};
