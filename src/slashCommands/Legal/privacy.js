const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { safeReply, safeDeferReply } = require("../../utils/interactionResponder");

const EMOJIS = require("../../utils/emoji.json");

module.exports = {
  name: "privacy",
  description: "Show privacy policy and how to request data rights actions.",
  run: async (client, interaction) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const legal = client?.legalLinks || {};

    const deferred = await safeDeferReply(interaction, { ephemeral: true });
    if (!deferred) return safeReply(interaction, { content: "Failed to process this command." });

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

    return safeReply(interaction, { embeds: [embed], components: [linksRow] });
  },
};


