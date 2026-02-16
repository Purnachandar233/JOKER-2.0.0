const { EmbedBuilder } = require("discord.js");

const redeemCode = require("../../schema/redemcode.js");

const EMOJIS = require("../../utils/emoji.json");
function parseDurationToken(token) {
  if (!token || token.toLowerCase() === "permanent") {
    return { permanent: true, expiry: null, text: "Permanent" };
  }

  const match = token.toLowerCase().match(/^(\d+)([mhdy])$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  const unitMap = {
    m: { ms: 60 * 1000, label: "minute" },
    h: { ms: 60 * 60 * 1000, label: "hour" },
    d: { ms: 24 * 60 * 60 * 1000, label: "day" },
    y: { ms: 365 * 24 * 60 * 60 * 1000, label: "year" }
  };

  const info = unitMap[unit];
  const expiry = Date.now() + (amount * info.ms);
  return {
    permanent: false,
    expiry,
    text: `${amount} ${info.label}${amount > 1 ? "s" : ""}`
  };
}

module.exports = {
  name: "generate-code",
  category: "owner",
  aliases: ["gen-code", "gencode", "gcu"],
  description: "Generates a redeem code for user or guild premium.",
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

    const no = EMOJIS.no;
    const ok = EMOJIS.ok;
    const typeArg = args[0]?.toLowerCase();
    const timeArg = args[1]?.toLowerCase() || "permanent";

    if (!typeArg || !["user", "server", "guild"].includes(typeArg)) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Invalid Arguments`,
        description: [
          `${no} Usage: \`${prefix}generate-code <user|server> [duration]\``,
          "",
          "Examples:",
          `\`${prefix}generate-code user permanent\``,
          `\`${prefix}generate-code server 7d\``,
          "",
          "Duration format: `30m`, `2h`, `7d`, `1y`, or `permanent`"
        ].join("\n")
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    const duration = parseDurationToken(timeArg);
    if (!duration) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Invalid Duration`,
        description: `${no} Use: \`30m\`, \`2h\`, \`7d\`, \`1y\`, or \`permanent\`.`
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    const code = `JOKER-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
    const premiumType = typeArg === "server" || typeArg === "guild" ? "guild" : "user";

    try {
      await redeemCode.create({
        Code: code,
        Expiry: duration.expiry,
        Permanent: duration.permanent,
        Usage: 1,
        Type: premiumType
      });

      const embed = createEmbed({
        title: `${getEmoji("premium")} Premium Code Generated`,
        description: `${ok} New redeem code has been created.`,
        fields: [
          statField("Code", `\`${code}\``, "premium"),
          statField("Type", `\`${premiumType === "guild" ? "Server/Guild" : "User"}\``, "server"),
          statField("Duration", `\`${duration.text}\``, "time")
        ],
        footer: "Redeem with /redeem or prefix redeem command"
      });

      try {
        await message.author.send({ embeds: [embed] });
        if (message.guild) {
          await message.channel.send(`${ok} Generated code \`${code}\` (${duration.text}). Sent to your DM.`);
        }
      } catch (_err) {
        await message.channel.send({ embeds: [embed] });
      }

      client.logger?.log?.(
        `[CODE] Generated ${premiumType} premium code ${code} (${duration.text}) by ${message.author.id}`,
        "info"
      );
    } catch (error) {
      client.logger?.log?.(error?.stack || error?.message || String(error), "error");
      const embed = createEmbed({
        title: `${getEmoji("error")} Code Generation Failed`,
        description: `${no} Error creating code: ${error?.message || "Unknown error"}`
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }
  }
};

