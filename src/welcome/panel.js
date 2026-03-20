const { ContainerBuilder, TextDisplayBuilder } = require("discord.js");
const { welcomeVariablesText } = require("./template");

function resolveAccentColor(color) {
  if (typeof color === "number" && Number.isFinite(color)) return color;
  const parsed = parseInt(String(color || "").replace(/^#/, ""), 16);
  return Number.isFinite(parsed) ? parsed : 0xff0051;
}

function resolveDeliveryType(value) {
  return String(value || "").toLowerCase() === "text" ? "text" : "embed";
}

function getQuickStartLines({ prefix = "!", slash = false }) {
  if (slash) {
    return [
      "1. `/welcome setup channel:#welcome message:Welcome {user} to {server}!`",
      "2. `/welcome textmsg status:true` (optional: text mode)",
      "3. `/welcome toggle status:true`",
      "4. `/welcome test`",
    ];
  }

  return [
    `1. \`${prefix}welcome setup <#channel> Welcome {user} to {server}!\``,
    `2. \`${prefix}welcome textmsg on\` (optional: text mode)`,
    `3. \`${prefix}welcome toggle on\``,
    `4. \`${prefix}welcome test\``,
  ];
}

function buildWelcomeSetupPanel({
  data = null,
  guild = null,
  embedColor = "#ff0051",
  prefix = "!",
  slash = false,
} = {}) {
  const enabled = Boolean(data?.enabled);
  const channelLabel = data?.channelID ? `<#${data.channelID}>` : "`Not set`";
  const roleLabel = data?.roleID ? `<@&${data.roleID}>` : "`Not set`";
  const colorLabel = `\`${data?.embedColor || embedColor}\``;
  const deliveryType = resolveDeliveryType(data?.deliveryType);
  const deliveryLabel = deliveryType === "text" ? "`Text Message`" : "`Embed`";
  const titleLabel = `\`${String(data?.title || "Welcome!").slice(0, 120)}\``;
  const messageLabel = `\`${String(data?.message || "Welcome {user} to {server}!").slice(0, 180)}\``;
  const quickStart = getQuickStartLines({ prefix, slash }).join("\n");
  const variables = welcomeVariablesText();
  const guildName = guild?.name || "This Server";

  const statusLines = [
    `Status: ${enabled ? "`Enabled`" : "`Disabled`"}`,
    `Channel: ${channelLabel}`,
    `Delivery: ${deliveryLabel}`,
    `Auto Role: ${roleLabel}`,
    `Color: ${colorLabel}`,
  ].join("\n");

  return [
    new ContainerBuilder()
      .setAccentColor(resolveAccentColor(embedColor))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## Welcome Setup Panel\nConfigure welcomes quickly for **${guildName}**.`),
        new TextDisplayBuilder().setContent(`### Current Settings\n${statusLines}`),
        new TextDisplayBuilder().setContent(`### Content\nTitle: ${titleLabel}\nMessage: ${messageLabel}`),
        new TextDisplayBuilder().setContent(`### Quick Start\n${quickStart}`),
        new TextDisplayBuilder().setContent(`### Variables\n${variables}`)
      ),
  ];
}

module.exports = {
  buildWelcomeSetupPanel,
  resolveDeliveryType,
};

