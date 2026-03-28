const { ApplicationCommandOptionType, EmbedBuilder, MessageFlags } = require("discord.js");

const { safeReply, safeDeferReply } = require("../../utils/interactionResponder");
const EMOJIS = require("../../utils/emoji.json");
const Schema = require("../../schema/welcome");
const {
  DEFAULT_WELCOME_EMBED_MESSAGE,
  DEFAULT_WELCOME_TEXT_MESSAGE,
  DEFAULT_WELCOME_TITLE,
  normalizeWelcomeColor,
  renderWelcomeTemplate,
} = require("../../welcome/template");
const { buildWelcomeSetupPanel } = require("../../welcome/panel");

function hasWelcomeManagePermission(interaction) {
  const permissions = interaction?.memberPermissions || interaction?.member?.permissions;
  if (!permissions || typeof permissions.has !== "function") return false;
  return permissions.has("ManageGuild") || permissions.has("Administrator");
}

module.exports = {
  name: "welcome",
  description: "Configure welcome messages for your server.",
  userPermissions: ["Administrator"],
  options: [
    {
      name: "setup",
      description: "Set welcome channel and optional embed message.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "channel",
          description: "Welcome channel",
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
        {
          name: "message",
          description: "Welcome embed template",
          type: ApplicationCommandOptionType.String,
          required: false,
        },
        {
          name: "color",
          description: "Hex color like #ff0051 or default",
          type: ApplicationCommandOptionType.String,
          required: false,
        },
      ],
    },
    {
      name: "message",
      description: "Update the welcome embed message template.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "text",
          description: "Welcome embed template text",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: "title",
      description: "Update the welcome embed title.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "text",
          description: "Embed title",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: "color",
      description: "Set welcome embed color.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "value",
          description: "Hex color like #ff0051 or default",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: "role",
      description: "Set auto-role for new members.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "role",
          description: "Role to assign",
          type: ApplicationCommandOptionType.Role,
          required: true,
        },
      ],
    },
    {
      name: "clearrole",
      description: "Remove auto-role configuration.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "clear",
      description: "Delete all welcome configuration for this server.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "panel",
      description: "Show the welcome setup panel.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "view",
      description: "View welcome settings.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "test",
      description: "Send a welcome preview.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "textmsg",
      description: "Restore or remove the default text welcome message.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "status",
          description: "Enable or disable the default text welcome",
          type: ApplicationCommandOptionType.Boolean,
          required: true,
        },
      ],
    },
    {
      name: "toggle",
      description: "Enable or disable welcome system.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "status",
          description: "Enable or disable",
          type: ApplicationCommandOptionType.Boolean,
          required: true,
        },
      ],
    },
  ],

  run: async (client, interaction) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline,
    });
    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const { guildId, guild } = interaction;

    if (!hasWelcomeManagePermission(interaction)) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription("*You need the `Manage Server` or `Administrator` permission to configure the welcome system.*");
      return safeReply(interaction, { embeds: [embed] });
    }

    const sendSetupPanel = async () => {
      const data = await Schema.findOne({ guildID: guildId }).lean().catch(() => null);
      const components = buildWelcomeSetupPanel({
        data,
        guild,
        embedColor,
        slash: true,
      });

      const panelMessage = await safeReply(interaction, {
        flags: MessageFlags.IsComponentsV2,
        components,
      });
      if (panelMessage) return panelMessage;

      const fallback = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("server")} Welcome Setup`)
        .setDescription(
          `${ok} Use \`/welcome setup\` to configure the channel and embed message.\n` +
          "Open the panel if you want to manage both embed and text templates visually."
        );
      return safeReply(interaction, { embeds: [fallback] });
    };

    const sub = interaction.options.getSubcommand();
    if (sub === "panel" || sub === "view") {
      return sendSetupPanel();
    }

    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) {
      return safeReply(interaction, { content: "Failed to process this interaction." });
    }

    if (sub === "setup") {
      const channel = interaction.options.getChannel("channel");
      const template = interaction.options.getString("message") || DEFAULT_WELCOME_EMBED_MESSAGE;
      const requestedColor = interaction.options.getString("color");
      const resolvedColor = requestedColor
        ? normalizeWelcomeColor(requestedColor, client.embedColor)
        : null;

      if (!channel || !channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("error")} Invalid Channel`)
          .setDescription(`${no} Please choose a text-based channel.`);
        return safeReply(interaction, { embeds: [embed] });
      }

      if (requestedColor && !resolvedColor) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("error")} Invalid Color`)
          .setDescription(`${no} Use hex format like \`#ff0051\` or \`default\`.`);
        return safeReply(interaction, { embeds: [embed] });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        {
          channelID: channel.id,
          message: template,
          title: DEFAULT_WELCOME_TITLE,
          textMessage: null,
          enabled: true,
          ...(resolvedColor ? { embedColor: resolvedColor } : {}),
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Welcome Configured`)
        .setDescription(`${ok} Welcome system configured and enabled.`)
        .addFields(
          statField("Channel", `<#${channel.id}>`, "server"),
          statField("Status", "`Enabled`", "success"),
          { name: `${getEmoji("info")} Embed Message`, value: `\`${template}\``, inline: false },
          { name: `${getEmoji("info")} Text Message`, value: "`Not set`", inline: false }
        );
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "message") {
      const text = interaction.options.getString("text");
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { message: text },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Welcome Message Updated`)
        .setDescription(`${ok} New welcome embed template saved.`)
        .addFields({ name: `${getEmoji("info")} Template`, value: `\`${text}\``, inline: false });
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "title") {
      const title = interaction.options.getString("text").slice(0, 256);
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { title },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Welcome Title Updated`)
        .setDescription(`${ok} New title set to \`${title}\`.`);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "color") {
      const rawColor = interaction.options.getString("value");
      const parsed = normalizeWelcomeColor(rawColor, client.embedColor);
      if (!parsed) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("error")} Invalid Color`)
          .setDescription(`${no} Use hex format like \`#ff0051\` or \`default\`.`);
        return safeReply(interaction, { embeds: [embed] });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { embedColor: parsed },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Welcome Color Updated`)
        .setDescription(`${ok} Welcome embed color set to \`${parsed}\`.`);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "role") {
      const role = interaction.options.getRole("role");
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { roleID: role.id },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Auto Role Updated`)
        .setDescription(`${ok} New members will receive <@&${role.id}>.`);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "clearrole") {
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { roleID: null },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Auto Role Cleared`)
        .setDescription(`${ok} Auto-role assignment has been disabled.`);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "clear") {
      await Schema.deleteMany({ guildID: guildId }).catch(() => {});
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Welcome Data Cleared`)
        .setDescription(`${ok} All welcome settings for this server were deleted.`);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "test") {
      const data = await Schema.findOne({ guildID: guildId });
      if (!data?.channelID) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("error")} Welcome Not Configured`)
          .setDescription(`${no} Configure it first using \`/welcome setup\`.`);
        return safeReply(interaction, { embeds: [embed] });
      }

      const channel = guild.channels.cache.get(data.channelID);
      if (!channel || !channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("error")} Invalid Welcome Channel`)
          .setDescription(`${no} Configured channel does not exist or is not text-based.`);
        return safeReply(interaction, { embeds: [embed] });
      }

      const previewMember = guild.members.cache.get(interaction.user.id) || interaction.member;
      const hasEmbedTemplate = Boolean(String(data.message || "").trim());
      const hasTextTemplate = Boolean(String(data.textMessage || "").trim());

      if (!hasEmbedTemplate && !hasTextTemplate) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("error")} No Welcome Content`)
          .setDescription(`${no} Set an embed message or a text message first.`);
        return safeReply(interaction, { embeds: [embed] });
      }

      if (hasTextTemplate) {
        const textPreview = renderWelcomeTemplate(data.textMessage, previewMember, "");
        await channel.send({ content: textPreview }).catch(() => {});
      }

      if (hasEmbedTemplate) {
        const preview = renderWelcomeTemplate(data.message, previewMember, "");
        const testEmbed = new EmbedBuilder()
          .setColor(data.embedColor || client.embedColor || embedColor)
          .setTitle(data.title || DEFAULT_WELCOME_TITLE)
          .setDescription(preview)
          .setThumbnail(interaction.user.displayAvatarURL({ forceStatic: false }))
          .setFooter({ text: `Member #${guild.memberCount}` });
        await channel.send({ embeds: [testEmbed] }).catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Test Sent`)
        .setDescription(`${ok} Welcome preview sent to <#${channel.id}>.`);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "textmsg") {
      const status = interaction.options.getBoolean("status");
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { textMessage: status ? DEFAULT_WELCOME_TEXT_MESSAGE : null },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("success")} Text Welcome Updated`)
        .setDescription(
          status
            ? `${ok} Default text welcome restored.`
            : `${ok} Text welcome removed.`
        );
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("status");
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { enabled },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(enabled ? `${getEmoji("success")} Welcome Enabled` : `${getEmoji("error")} Welcome Disabled`)
        .setDescription(
          enabled
            ? `${ok} New members will receive welcome messages.`
            : `${ok} Welcome messages are disabled.`
        );
      return safeReply(interaction, { embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("error")} Invalid Subcommand`)
      .setDescription(`${no} Use \`/welcome view\` to check current configuration.`);
    return safeReply(interaction, { embeds: [embed] });
  },
};
