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
const { safeReply } = require("../../utils/interactionResponder");

function isInteraction(ctx) {
  return Boolean(ctx && typeof ctx.deferReply === "function" && typeof ctx.editReply === "function");
}

async function sendResponse(ctx, payload) {
  if (isInteraction(ctx)) {
    const normalized = typeof payload === "string" ? { content: payload } : payload;
    return safeReply(ctx, normalized);
  }
  return ctx.channel.send(payload);
}

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
  if (!active) return `${getEmoji("no")} ${label}: **Inactive**`;

  if (doc?.Permanent) return `${getEmoji("ok")} ${label}: **Active (Permanent)**`;

  const remainingLabel = formatRemainingLabel(doc?.Expire, now);
  if (remainingLabel) return `${getEmoji("ok")} ${label}: **Active (${remainingLabel})**`;

  if (voteFallback) return `${getEmoji("ok")} ${label}: **Active (Vote Window)**`;

  return `${getEmoji("ok")} ${label}: **Active**`;
}

module.exports = {
  name: "premium",
  category: "general",
  description: "Shows premium status and actions.",
  owner: false,
  wl: true,
  execute: async (ctx, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";

    const userId = ctx?.author?.id || ctx?.user?.id;
    const guildId = ctx?.guild?.id || null;
    const access = await resolvePremiumAccess(userId, guildId, client);
    const now = Date.now();

    const userStatusLine = formatPremiumStatusLine("Your Premium", {
      active: access.userPremium,
      doc: access.userDoc,
      now,
      voteFallback: access.topggFallbackVoted,
    });

    const serverStatusLine = guildId
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
      .setLabel("Premium Info")
      .setURL(`https://top.gg/bot/${client.user.id}`);

    const quickLinkSupport = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Support Server")
      .setURL(client?.legalLinks?.supportServerUrl || "https://discord.gg/JQzBqgmwFm");

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
            ? "Premium is already active. You can still vote to extend premium."
            : "Use Top.gg vote for temporary access. Support, privacy, and terms links are below for additional premium information."
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
      return await sendResponse(ctx, {
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
      return sendResponse(ctx, { embeds: [fallbackEmbed], components: [linkRow] });
    }
  },
};
