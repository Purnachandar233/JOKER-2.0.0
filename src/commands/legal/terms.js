const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");

module.exports = {
  name: "terms",
  category: "general",
  aliases: ["tos", "terms-of-service"],
  description: "Shows the Terms of Service link.",
  execute: async (message, _args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const legal = client?.legalLinks || {};

    const termsButton = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Terms of Service")
      .setURL(legal.termsOfServiceUrl);

    const privacyButton = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Privacy Policy")
      .setURL(legal.privacyPolicyUrl);

    const linksRow = new ActionRowBuilder().addComponents(termsButton, privacyButton);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("info", "Terms")} Terms of Service`)
      .setDescription(
        [
          `Terms of Service: ${legal.termsOfServiceUrl}`,
          `Privacy Policy: ${legal.privacyPolicyUrl}`,
        ].join("\n")
      );

    return message.channel.send({ embeds: [embed], components: [linksRow] });
  },
};


