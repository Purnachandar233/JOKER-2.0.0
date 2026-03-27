const {
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const {
  DEFAULT_WELCOME_EMBED_MESSAGE,
  DEFAULT_WELCOME_TEXT_MESSAGE,
  DEFAULT_WELCOME_TITLE,
  resolveWelcomeTemplate,
  welcomeVariablesText,
} = require("./template");

function resolveAccentColor(color) {
  if (typeof color === "number" && Number.isFinite(color)) return color;
  const parsed = parseInt(String(color || "").replace(/^#/, ""), 16);
  return Number.isFinite(parsed) ? parsed : 0xff0051;
}

function getQuickStartLines({ slash = false }) {
  if (slash) {
    return [
      "Choose a channel, then set your embed and text templates.",
      "Toggle Embed or Text delivery depending on what you want to send.",
    ];
  }

  return [
    "Choose a channel, then set your embed and text templates.",
    "Toggle Embed or Text delivery depending on what you want to send.",
  ];
}

function summarizeTemplate(template, fallback, maxLength = 180) {
  const resolved = resolveWelcomeTemplate(template, fallback);
  const normalized = resolved.replace(/\s+/g, " ").trim();
  return `\`${normalized.slice(0, maxLength)}${normalized.length > maxLength ? "..." : ""}\``;
}

function buildWelcomeSetupPanel({
  data = null,
  guild = null,
  embedColor = "#ff0051",
  prefix = "!",
  slash = false,
  statusMessage = null,
} = {}) {
  const enabled = Boolean(data?.enabled);
  const embedEnabled = Boolean(data?.embedEnabled !== false);
  const textEnabled = Boolean(data?.textEnabled);
  const channelLabel = data?.channelID ? `<#${data.channelID}>` : "`Not set`";
  const roleLabel = data?.roleID ? `<@&${data.roleID}>` : "`Not set`";
  const colorLabel = `\`${data?.embedColor || embedColor}\``;
  const titleLabel = `\`${String(data?.title || DEFAULT_WELCOME_TITLE).slice(0, 120)}\``;
  const embedMessageLabel = summarizeTemplate(data?.message, DEFAULT_WELCOME_EMBED_MESSAGE);
  const textMessageLabel = summarizeTemplate(data?.textMessage, DEFAULT_WELCOME_TEXT_MESSAGE);
  const deliveryLabel = [
    embedEnabled ? "`Embed`" : null,
    textEnabled ? "`Text`" : null,
  ].filter(Boolean).join(" + ") || "`None`";
  const quickStart = getQuickStartLines({ prefix, slash }).join("\n");
  const variables = welcomeVariablesText();
  const guildName = guild?.name || "This Server";
  const trimmedStatusMessage = String(statusMessage || "").trim();

  const statusLines = [
    `Status: ${enabled ? "`Enabled`" : "`Disabled`"}`,
    `Channel: ${channelLabel}`,
    `Delivery: ${deliveryLabel}`,
    `Auto Role: ${roleLabel}`,
    `Color: ${colorLabel}`,
  ].join("\n");

  const channelOptions = guild.channels.cache
    .filter(ch => ch.isTextBased())
    .map(ch => ({
      label: ch.name,
      value: ch.id,
      description: `#${ch.name}`,
    }))
    .slice(0, 25);

  const channelSelect = new StringSelectMenuBuilder()
    .setCustomId("welcome_select_channel")
    .setPlaceholder("Select welcome channel")
    .addOptions(
      channelOptions.length > 0
        ? channelOptions
        : [{ label: "No text channels", value: "none", description: "Create a channel first" }]
    );

  const roleOptions = guild.roles.cache
    .filter(role => !role.managed && role.id !== guild.id)
    .map(role => ({
      label: role.name,
      value: role.id,
      description: `@${role.name}`,
    }))
    .slice(0, 25);

  const roleSelect = new StringSelectMenuBuilder()
    .setCustomId("welcome_select_role")
    .setPlaceholder("Select auto-role (optional)")
    .setRequired(false)
    .addOptions(
      roleOptions.length > 0
        ? roleOptions
        : [{ label: "No roles available", value: "none", description: "Create a role first" }]
    );

  const selectRow1 = new ActionRowBuilder().addComponents(channelSelect);
  const selectRow2 = new ActionRowBuilder().addComponents(roleSelect);

  const setupButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("welcome_set_message")
      .setLabel("Embed Message")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("welcome_set_text_message")
      .setLabel("Text Message")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("welcome_set_title")
      .setLabel("Title")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("welcome_set_color")
      .setLabel("Color")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("welcome_clear_role")
      .setLabel("Clear Role")
      .setStyle(ButtonStyle.Secondary)
  );

  const toggleButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("welcome_toggle_embed")
      .setLabel(embedEnabled ? "Embed On" : "Embed Off")
      .setStyle(embedEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("welcome_toggle_text")
      .setLabel(textEnabled ? "Text On" : "Text Off")
      .setStyle(textEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("welcome_toggle_enable")
      .setLabel(enabled ? "Enabled" : "Disabled")
      .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success)
  );

  const actionButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("welcome_test")
      .setLabel("Test Welcome")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("welcome_refresh")
      .setLabel("Refresh")
      .setStyle(ButtonStyle.Secondary)
  );

  const textDisplays = [];
  if (trimmedStatusMessage) {
    textDisplays.push(
      new TextDisplayBuilder().setContent(`### Latest Action\n${trimmedStatusMessage}`)
    );
  }

  textDisplays.push(
    new TextDisplayBuilder().setContent(`## Welcome Setup Panel\nConfigure welcomes for **${guildName}**.`),
    new TextDisplayBuilder().setContent(`### Current Settings\n${statusLines}`),
    new TextDisplayBuilder().setContent(
      `### Content\nTitle: ${titleLabel}\nEmbed Message: ${embedMessageLabel}\nText Message: ${textMessageLabel}`
    ),
    new TextDisplayBuilder().setContent(`### Quick Start\n${quickStart}`),
    new TextDisplayBuilder().setContent(`### Variables\n${variables}`)
  );

  return [
    new ContainerBuilder()
      .setAccentColor(resolveAccentColor(embedColor))
      .addTextDisplayComponents(...textDisplays)
      .addActionRowComponents(
        selectRow1,
        selectRow2,
        setupButtons,
        toggleButtons,
        actionButtons
      ),
  ];
}

module.exports = {
  buildWelcomeSetupPanel,
};
