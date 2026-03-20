const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  SectionBuilder,
  TextDisplayBuilder,
} = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const formatDuration = require("../../utils/formatDuration");
const { resolvePremiumAccess } = require("../../utils/premiumAccess");

function resolveAccentColor(color) {
  if (typeof color === "number" && Number.isFinite(color)) return color;
  const parsed = parseInt(String(color || "").replace(/^#/, ""), 16);
  return Number.isFinite(parsed) ? parsed : 0xff0051;
}

function formatRemainingLabel(expireAt, now = Date.now()) {
  const remaining = Number(expireAt || 0) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  return formatDuration(remaining, { verbose: false }).replace(/\s\d+s$/, "");
}

function formatPremiumStatusLine(label, { active = false, doc = null, now = Date.now(), voteFallback = false } = {}) {
  if (!active) return `X ${label}: **Inactive**`;

  if (doc?.Permanent) return `OK ${label}: **Active (Permanent)**`;

  const remainingLabel = formatRemainingLabel(doc?.Expire, now);
  if (remainingLabel) return `OK ${label}: **Active (${remainingLabel})**`;

  if (voteFallback) return `OK ${label}: **Active (Vote Window)**`;

  return `OK ${label}: **Active**`;
}

module.exports = {
  name: "premium",
  category: "general",
  description: "Shows premium status and actions.",
  owner: false,
  wl: true,
  execute: async (message, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";

    const access = await resolvePremiumAccess(message.author.id, message.guild?.id, client);
    const now = Date.now();

    const userStatusLine = formatPremiumStatusLine("Your Premium", {
      active: access.userPremium,
      doc: access.userDoc,
      now,
      voteFallback: access.topggFallbackVoted,
    });

    const serverStatusLine = message.guild?.id
      ? formatPremiumStatusLine("Server Premium", {
          active: access.guildPremium,
          doc: access.guildDoc,
          now,
        })
      : "Info Server Premium: **Unavailable in DM**";

    const activateButton = new ButtonBuilder()
      .setCustomId("premium_dashboard_activate")
      .setStyle(ButtonStyle.Success)
      .setLabel(access.hasAccess ? "Premium Active" : "Activate Premium");

    const deactivateButton = new ButtonBuilder()
      .setCustomId("premium_dashboard_deactivate")
      .setStyle(ButtonStyle.Danger)
      .setLabel("Deactivate Premium")
      .setDisabled(!access.hasAccess);

    const quickLinkPremium = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Premium")
      .setURL(`https://top.gg/bot/${client.user.id}/vote`);

    const quickLinkSupport = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Support Server")
      .setURL("https://discord.gg/JQzBqgmwFm");

    try {
      const premiumEmoji = getEmoji("premium");
      if (premiumEmoji) quickLinkPremium.setEmoji(premiumEmoji);
    } catch (_e) {}

    try {
      const supportEmoji = getEmoji("support");
      if (supportEmoji) quickLinkSupport.setEmoji(supportEmoji);
    } catch (_e) {}

    const activateSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("### Activate Premium"),
        new TextDisplayBuilder().setContent(
          access.hasAccess
            ? "Premium is already active. You can still vote to extend temporary windows."
            : "Use Top.gg vote or contact support to activate premium features."
        )
      )
      .setButtonAccessory(activateButton);

    const deactivateSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("### Deactivate Premium"),
        new TextDisplayBuilder().setContent(
          access.hasAccess
            ? "Use this for safe guidance before deactivation so premium is not lost accidentally."
            : "Premium is not currently active in your effective access scope."
        )
      )
      .setButtonAccessory(deactivateButton);

    const linkRow = new ActionRowBuilder().addComponents(quickLinkPremium, quickLinkSupport);

    const dashboardContainer = new ContainerBuilder()
      .setAccentColor(resolveAccentColor(embedColor))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Premium Dashboard"),
        new TextDisplayBuilder().setContent("Manage your premium features and view current status"),
        new TextDisplayBuilder().setContent("### Current Status"),
        new TextDisplayBuilder().setContent(`${userStatusLine}\n${serverStatusLine}`),
        new TextDisplayBuilder().setContent(
          access.hasAccess
            ? "Premium commands are currently unlocked for you."
            : "Get premium to unlock exclusive features!"
        ),
        new TextDisplayBuilder().setContent("### Quick Actions"),
        new TextDisplayBuilder().setContent("Choose an action below to manage your premium features:"),
      )
      .addSectionComponents(activateSection)
      .addSectionComponents(deactivateSection)
      .addActionRowComponents(linkRow);

    try {
      return await message.channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [dashboardContainer],
      });
    } catch (_err) {
      const fallbackEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("premium")} Premium Dashboard`)
        .setDescription(
          [
            userStatusLine,
            serverStatusLine,
            "",
            access.hasAccess
              ? "Premium commands are currently unlocked for you."
              : "Get premium to unlock exclusive features!",
          ].join("\n")
        );
      return message.channel.send({ embeds: [fallbackEmbed], components: [linkRow] });
    }
  },
};
