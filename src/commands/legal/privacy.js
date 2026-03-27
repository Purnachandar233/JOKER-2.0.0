const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");

module.exports = {
  name: "privacy",
  category: "general",
  aliases: ["privacy-policy", "privacypolicy"],
  description: "Shows the privacy policy link and how to request data rights actions.",
  execute: async (message, _args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const legal = client?.legalLinks || {};

    const privacyButton = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Privacy Policy")
      .setURL(legal.privacyPolicyUrl);

    const termsButton = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Terms")
      .setURL(legal.termsOfServiceUrl);

    const linksRow = new ActionRowBuilder().addComponents(privacyButton, termsButton);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("lock", "Privacy")} Privacy & Data Rights`)
      .setDescription(
        [
          `Privacy Policy: ${legal.privacyPolicyUrl}`,
          `Terms of Service: ${legal.termsOfServiceUrl}`,
          "",
          "Data rights requests:",
          "- Contact us to request access to or deletion of your stored bot data.",
          `- Support server: ${legal.supportServerUrl}`,
          `- Email: ${legal.privacyContactEmail || "privacy@jokerbot.com"}`,
        ].join("\n")
      );

    return message.channel.send({ embeds: [embed], components: [linksRow] });
  },
};


