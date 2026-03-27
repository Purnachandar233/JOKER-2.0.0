const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\/\S+$/i.test(value.trim());
}

function createLinkButton({ label, url, emoji = null }) {
  if (!isHttpUrl(url)) return null;

  const button = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel(label)
    .setURL(url);

  try {
    if (emoji) button.setEmoji(emoji);
  } catch (_err) {}

  return button;
}

function buildAccessRequiredPrompt({
  client,
  commandLabel = "this command",
  isPremiumCommand = false,
  avatarURL = null,
  getEmoji = () => "",
} = {}) {
  const legal = client?.legalLinks || {};
  const voteUrl = `https://top.gg/bot/${client?.user?.id}/vote`;
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${client?.user?.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`;
  const label = String(commandLabel || "this command").trim() || "this command";

  const embed = new EmbedBuilder()
    .setColor(client?.embedColor || "#ff0051")
    .setAuthor({
      name: isPremiumCommand ? "Premium Required" : "Vote Required",
      ...(avatarURL ? { iconURL: avatarURL } : {}),
    })
    .setDescription(
      isPremiumCommand
        ? `**${label}** is a premium command.\nVote on Top.gg for temporary access, or review the support and legal links for premium access information.`
        : `**${label}** requires a vote.\nVote on Top.gg to unlock this command for 12 hours.`
    );

  const voteButton = createLinkButton({
    label: "Vote",
    url: voteUrl,
    emoji: getEmoji("vote"),
  });
  const supportButton = createLinkButton({
    label: "Support",
    url: legal.supportServerUrl,
    emoji: getEmoji("support"),
  });
  const inviteButton = createLinkButton({
    label: "Invite",
    url: inviteUrl,
    emoji: getEmoji("invite"),
  });
  const privacyButton = createLinkButton({
    label: "Privacy",
    url: legal.privacyPolicyUrl,
  });
  const termsButton = createLinkButton({
    label: "Terms",
    url: legal.termsOfServiceUrl,
  });

  const components = [];
  const primaryButtons = [supportButton, inviteButton, voteButton].filter(Boolean);
  const legalButtons = [privacyButton, termsButton].filter(Boolean);

  if (primaryButtons.length) {
    components.push(new ActionRowBuilder().addComponents(primaryButtons));
  }

  if (legalButtons.length) {
    components.push(new ActionRowBuilder().addComponents(legalButtons));
  }

  return { embed, components };
}

module.exports = {
  buildAccessRequiredPrompt,
};
