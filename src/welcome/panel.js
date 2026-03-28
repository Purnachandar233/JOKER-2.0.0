const {
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
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

function getQuickStartLines() {
  return [
    "Choose a welcome channel first.",
    "Set the embed and text templates you want.",
    "Use the clear buttons to remove either one instantly.",
    "If only one template exists, only that one is sent.",
  ];
}

function summarizeTemplate(template, fallback, maxLength = 180) {
  const raw = String(template || "").trim();
  if (!raw) return "`Not set`";
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
  const embedConfigured = Boolean(String(data?.message || "").trim());
  const textConfigured = Boolean(String(data?.textMessage || "").trim());
  const channelLabel = data?.channelID ? `<#${data.channelID}>` : "`Not set`";
  const roleLabel = data?.roleID ? `<@&${data.roleID}>` : "`Not set`";
  const colorLabel = `\`${data?.embedColor || embedColor}\``;
  const titleLabel = embedConfigured
    ? `\`${String(data?.title || DEFAULT_WELCOME_TITLE).slice(0, 120)}\``
    : "`Not set`";
  const embedMessageLabel = summarizeTemplate(data?.message, DEFAULT_WELCOME_EMBED_MESSAGE);
  const textMessageLabel = summarizeTemplate(data?.textMessage, DEFAULT_WELCOME_TEXT_MESSAGE);
  const deliveryLabel = [
    embedConfigured ? "`Embed`" : null,
    textConfigured ? "`Text`" : null,
  ].filter(Boolean).join(" + ") || "`None`";
  const quickStart = getQuickStartLines({ prefix, slash }).join("\n");
  const variables = welcomeVariablesText();
  const guildName = guild?.name || "This Server";
  const trimmedStatusMessage = String(statusMessage || "").trim();
  const selectedChannel = data?.channelID ? guild?.channels?.cache?.get?.(data.channelID) : null;
  const selectedRole = data?.roleID ? guild?.roles?.cache?.get?.(data.roleID) : null;

  const statusLines = [
    `Status: ${enabled ? "`Enabled`" : "`Disabled`"}`,
    `Channel: ${channelLabel}`,
    `Delivery: ${deliveryLabel}`,
    `Auto Role: ${roleLabel}`,
    `Color: ${colorLabel}`,
  ].join("\n");

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("welcome_select_channel")
    .setPlaceholder(selectedChannel ? `Channel: #${selectedChannel.name}` : "Choose welcome channel")
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(1)
    .setMaxValues(1);
  if (selectedChannel?.id) channelSelect.setDefaultChannels(selectedChannel.id);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("welcome_select_role")
    .setPlaceholder(selectedRole ? `Role: @${selectedRole.name}` : "Choose auto-role (optional)")
    .setMinValues(1)
    .setMaxValues(1);
  if (selectedRole?.id) roleSelect.setDefaultRoles(selectedRole.id);

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
      .setStyle(ButtonStyle.Primary)
  );

  const actionButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("welcome_clear_message")
      .setLabel("Clear Embed")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!embedConfigured),
    new ButtonBuilder()
      .setCustomId("welcome_clear_text_message")
      .setLabel("Clear Text")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!textConfigured),
    new ButtonBuilder()
      .setCustomId("welcome_clear_role")
      .setLabel("Clear Role")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!data?.roleID),
    new ButtonBuilder()
      .setCustomId("welcome_test")
      .setLabel("Test Welcome")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("welcome_toggle_enable")
      .setLabel(enabled ? "Disable System" : "Enable System")
      .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success)
  );

  const textDisplays = [];
  if (trimmedStatusMessage) {
    textDisplays.push(
      new TextDisplayBuilder().setContent(`### Latest Action\n${trimmedStatusMessage}`)
    );
  }

  textDisplays.push(
    new TextDisplayBuilder().setContent(`## Welcome Setup Panel\nConfigure welcomes for **${guildName}**.`),
    new TextDisplayBuilder().setContent(`### Overview\n${statusLines}`),
    new TextDisplayBuilder().setContent(
      `### Templates\nTitle: ${titleLabel}\nEmbed Message: ${embedMessageLabel}\nText Message: ${textMessageLabel}`
    ),
    new TextDisplayBuilder().setContent(`### How It Works\n${quickStart}`),
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
        actionButtons
      ),
  ];
}

module.exports = {
  buildWelcomeSetupPanel,
};
