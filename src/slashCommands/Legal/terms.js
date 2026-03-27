const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { safeReply, safeDeferReply } = require("../../utils/interactionResponder");

const EMOJIS = require("../../utils/emoji.json");

module.exports = {
  name: "terms",
  description: "Show Terms of Service and Privacy Policy links.",
  run: async (client, interaction) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const legal = client?.legalLinks || {};

    const deferred = await safeDeferReply(interaction, { ephemeral: true });
    if (!deferred) return safeReply(interaction, { content: "Failed to process this command." });

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

    return safeReply(interaction, { embeds: [embed], components: [linksRow] });
  },
};


