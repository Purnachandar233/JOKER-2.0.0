const { ApplicationCommandOptionType, EmbedBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

const { safeReply, safeDeferReply } = require("../../utils/interactionResponder");
const EMOJIS = require("../../utils/emoji.json");
const Schema = require("../../schema/welcome");
const {
  normalizeWelcomeColor,
  renderWelcomeTemplate
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
      description: "Set welcome channel and optional message.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "channel",
          description: "Welcome channel",
          type: ApplicationCommandOptionType.Channel,
          required: true
        },
        {
          name: "message",
          description: "Welcome template",
          type: ApplicationCommandOptionType.String,
          required: false
        },
        {
          name: "color",
          description: "Hex color like #ff0051 or default",
          type: ApplicationCommandOptionType.String,
          required: false
        }
      ]
    },
    {
      name: "message",
      description: "Update welcome message template.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "text",
          description: "Welcome template text",
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: "title",
      description: "Update welcome embed title.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "text",
          description: "Embed title",
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
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
          required: true
        }
      ]
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
          required: true
        }
      ]
    },
    {
      name: "clearrole",
      description: "Remove auto-role configuration.",
      type: ApplicationCommandOptionType.Subcommand
    },
    {
      name: "clear",
      description: "Delete all welcome configuration for this server.",
      type: ApplicationCommandOptionType.Subcommand
    },
    {
      name: "panel",
      description: "Show an easy setup panel (V2).",
      type: ApplicationCommandOptionType.Subcommand
    },
    {
      name: "view",
      description: "View welcome settings.",
      type: ApplicationCommandOptionType.Subcommand
    },
    {
      name: "test",
      description: "Send a welcome preview.",
      type: ApplicationCommandOptionType.Subcommand
    },
    {
      name: "textmsg",
      description: "Set welcome delivery mode (text or embed).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "status",
          description: "Enable text message mode",
          type: ApplicationCommandOptionType.Boolean,
          required: true
        }
      ]
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
          required: true
        }
      ]
    }
  ],

  run: async (client, interaction) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const { guildId, guild } = interaction;
    let data2; // Declare once for reuse

    // Handle string select menus (dropdowns)
    if (interaction.isStringSelectMenu?.()) {
      if (!hasWelcomeManagePermission(interaction)) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setDescription("*You need the `Manage Server` or `Administrator` permission to configure the welcome system.*");
        return safeReply(interaction, { embeds: [embed], ephemeral: true });
      }

      await safeDeferReply(interaction, { ephemeral: true });

      const selectId = interaction.customId;
      const selectedValue = interaction.values?.[0];

      if (selectId === "welcome_select_channel") {
        if (selectedValue === "none") {
          const embed = new EmbedBuilder().setColor(embedColor);
          embed.setTitle(`${getEmoji("error")} No Channels`);
          embed.setDescription(`${no} Please create a text channel first.`);
          return safeReply(interaction, { embeds: [embed] });
        }

        const channel = guild.channels.cache.get(selectedValue);
        if (!channel) {
          const embed = new EmbedBuilder().setColor(embedColor);
          embed.setTitle(`${getEmoji("error")} Channel Not Found`);
          embed.setDescription(`${no} This channel no longer exists.`);
          return safeReply(interaction, { embeds: [embed] });
        }

        await Schema.findOneAndUpdate(
          { guildID: guildId },
          { 
            channelID: selectedValue,
            enabled: true,
            embedEnabled: true,
            textEnabled: false
          },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder().setColor(embedColor);
        embed.setTitle(`${getEmoji("success")} Channel Set`);
        embed.setDescription(`${ok} Welcome channel set to <#${selectedValue}>.`);
        return safeReply(interaction, { embeds: [embed] });
      }

      if (selectId === "welcome_select_role") {
        if (selectedValue === "none") {
          const embed = new EmbedBuilder().setColor(embedColor);
          embed.setTitle(`${getEmoji("info")} No Roles`);
          embed.setDescription(`${ok} No auto-role will be assigned.`);
          return safeReply(interaction, { embeds: [embed] });
        }

        const role = guild.roles.cache.get(selectedValue);
        if (!role) {
          const embed = new EmbedBuilder().setColor(embedColor);
          embed.setTitle(`${getEmoji("error")} Role Not Found`);
          embed.setDescription(`${no} This role no longer exists.`);
          return safeReply(interaction, { embeds: [embed] });
        }

        await Schema.findOneAndUpdate(
          { guildID: guildId },
          { roleID: selectedValue },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder().setColor(embedColor);
        embed.setTitle(`${getEmoji("success")} Auto-Role Set`);
        embed.setDescription(`${ok} New members will receive <@&${selectedValue}>.`);
        return safeReply(interaction, { embeds: [embed] });
      }

      return;
    }

    if (interaction.isModalSubmit?.()) {
      if (!hasWelcomeManagePermission(interaction)) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setDescription("*You need the `Manage Server` or `Administrator` permission to configure the welcome system.*");
        return safeReply(interaction, { embeds: [embed], ephemeral: true });
      }

      const modalId = interaction.customId;
      const data = await Schema.findOne({ guildID: guildId }).catch(() => null);

      if (modalId === "welcome_message_modal") {
        const messageText = interaction.fields.getTextInputValue("message_input");
        await Schema.findOneAndUpdate(
          { guildID: guildId },
          { message: messageText },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder().setColor(embedColor);
        embed.setTitle(`${getEmoji("success")} Message Updated`);
        embed.setDescription(`${ok} Welcome message template updated.`);
        embed.addFields({ name: `${getEmoji("info")} New Message`, value: `\`${messageText}\`` });
        return safeReply(interaction, { embeds: [embed], ephemeral: true });
      }

      if (modalId === "welcome_title_modal") {
        const titleText = interaction.fields.getTextInputValue("title_input");
        await Schema.findOneAndUpdate(
          { guildID: guildId },
          { title: titleText },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder().setColor(embedColor);
        embed.setTitle(`${getEmoji("success")} Title Updated`);
        embed.setDescription(`${ok} Embed title updated to \`${titleText}\`.`);
        return safeReply(interaction, { embeds: [embed], ephemeral: true });
      }

      if (modalId === "welcome_color_modal") {
        const colorText = interaction.fields.getTextInputValue("color_input");
        const { normalizeWelcomeColor } = require("../../welcome/template");
        const parsed = normalizeWelcomeColor(colorText, embedColor);
        
        if (!parsed) {
          const embed = new EmbedBuilder().setColor(embedColor);
          embed.setTitle(`${getEmoji("error")} Invalid Color`);
          embed.setDescription(`${no} Use hex format like \`#ff0051\` or \`default\`.`);
          return safeReply(interaction, { embeds: [embed], ephemeral: true });
        }

        await Schema.findOneAndUpdate(
          { guildID: guildId },
          { embedColor: parsed },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        const embed = new EmbedBuilder().setColor(embedColor);
        embed.setTitle(`${getEmoji("success")} Color Updated`);
        embed.setDescription(`${ok} Embed color set to \`${parsed}\`.`);
        return safeReply(interaction, { embeds: [embed], ephemeral: true });
      }

      return;
    }

    const sub = interaction.options.getSubcommand();

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
          `${ok} Use \`/welcome setup\` to configure channel/message.\n` +
          `Use \`/welcome textmsg status:true\` for text mode.`
        );
      return safeReply(interaction, { embeds: [fallback] });
    };

    if (sub === "panel") {
      return sendSetupPanel();
    }

    if (sub === "view") {
      return sendSetupPanel();
    }

    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: "Failed to process this interaction." });

    if (sub === "setup") {
      const channel = interaction.options.getChannel("channel");
      const template = interaction.options.getString("message") || "Welcome {user} to {server}!";
      const requestedColor = interaction.options.getString("color");
      const resolvedColor = requestedColor
        ? normalizeWelcomeColor(requestedColor, client.embedColor)
        : null;

      if (!channel || !channel.isTextBased()) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Invalid Channel`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Please choose a text-based channel.`;
        if (embedValue1) embed.setDescription(embedValue1);
        return safeReply(interaction, { embeds: [embed] });
      }
      if (requestedColor && !resolvedColor) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Invalid Color`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Use hex format like \`#ff0051\` or \`default\`.`;
        if (embedValue1) embed.setDescription(embedValue1);
        return safeReply(interaction, { embeds: [embed] });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        {
          channelID: channel.id,
          message: template,
          enabled: true,
          embedEnabled: true,
          textEnabled: false,
          ...(resolvedColor ? { embedColor: resolvedColor } : {})
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Welcome Configured`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} Welcome system configured and enabled.`;
      if (embedValue1) embed.setDescription(embedValue1);
      var embedValue2 = [
      statField("Channel", `<#${channel.id}>`, "server"),
      statField("Status", "`Enabled`", "success"),
      { name: `${getEmoji("info")} Message`, value: `\`${template}\``, inline: false }
      ];
      if (Array.isArray(embedValue2) && embedValue2.length > 0) embed.addFields(embedValue2);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "message") {
      const text = interaction.options.getString("text");
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { message: text },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Welcome Message Updated`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} New welcome template saved.`;
      if (embedValue1) embed.setDescription(embedValue1);
      var embedValue2 = [{ name: `${getEmoji("info")} Template`, value: `\`${text}\``, inline: false }];
      if (Array.isArray(embedValue2) && embedValue2.length > 0) embed.addFields(embedValue2);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "title") {
      const title = interaction.options.getString("text").slice(0, 256);
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { title },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Welcome Title Updated`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} New title set to \`${title}\`.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "color") {
      const rawColor = interaction.options.getString("value");
      const parsed = normalizeWelcomeColor(rawColor, client.embedColor);
      if (!parsed) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Invalid Color`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Use hex format like \`#ff0051\` or \`default\`.`;
        if (embedValue1) embed.setDescription(embedValue1);
        return safeReply(interaction, { embeds: [embed] });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { embedColor: parsed },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Welcome Color Updated`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} Welcome embed color set to \`${parsed}\`.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "role") {
      const role = interaction.options.getRole("role");
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { roleID: role.id },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Auto Role Updated`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} New members will receive <@&${role.id}>.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "clearrole") {
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { roleID: null },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Auto Role Cleared`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} Auto-role assignment has been disabled.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "clear") {
      await Schema.deleteMany({ guildID: guildId }).catch(() => {});
      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Welcome Data Cleared`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} All welcome settings for this server were deleted.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "test") {
      const data = await Schema.findOne({ guildID: guildId });
      if (!data?.channelID) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Welcome Not Configured`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Configure it first using \`/welcome setup\`.`;
        if (embedValue1) embed.setDescription(embedValue1);
        return safeReply(interaction, { embeds: [embed] });
      }

      const channel = guild.channels.cache.get(data.channelID);
      if (!channel || !channel.isTextBased()) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Invalid Welcome Channel`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Configured channel does not exist or is not text-based.`;
        if (embedValue1) embed.setDescription(embedValue1);
        return safeReply(interaction, { embeds: [embed] });
      }

      const previewMember = guild.members.cache.get(interaction.user.id) || interaction.member;
      const preview = renderWelcomeTemplate(data.message, previewMember);
      const embedEnabled = data.embedEnabled !== false; // default true
      const textEnabled = Boolean(data.textEnabled);

      // Send text message if enabled
      if (textEnabled) {
        await channel.send({ content: preview }).catch(() => {});
      }

      // Send embed if enabled
      if (embedEnabled) {
        const testEmbed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = data.title || "Welcome!";
        if (embedValue0) testEmbed.setTitle(embedValue0);
        var embedValue1 = preview;
        if (embedValue1) testEmbed.setDescription(embedValue1);
        var embedValue2 = interaction.user.displayAvatarURL({ forceStatic: false });
        if (embedValue2) testEmbed.setThumbnail(embedValue2);
        var embedValue3 = `Member #${guild.memberCount}`;
        if (embedValue3) {
        if (typeof embedValue3 === "string") testEmbed.setFooter({ text: embedValue3 });
        else testEmbed.setFooter(embedValue3);
        }
        testEmbed.setColor(data.embedColor || client.embedColor);
        await channel.send({ embeds: [testEmbed] }).catch(() => {});
      }

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Test Sent`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} Welcome preview sent to <#${channel.id}>.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "textmsg") {
      const status = interaction.options.getBoolean("status");
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { textEnabled: status },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Delivery Mode Updated`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = status
        ? `${ok} Text mode enabled. Both embed and text messages will be sent.`
        : `${ok} Text mode disabled. Only embed will be sent.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("status");
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { enabled },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = enabled
      ? `${getEmoji("success")} Welcome Enabled`
      : `${getEmoji("error")} Welcome Disabled`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = enabled
      ? `${ok} New members will receive welcome messages.`
      : `${ok} Welcome messages are disabled.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return safeReply(interaction, { embeds: [embed] });
    }

    const embed = new EmbedBuilder().setColor(embedColor);
    var embedValue0 = `${getEmoji("error")} Invalid Subcommand`;
    if (embedValue0) embed.setTitle(embedValue0);
    var embedValue1 = `${no} Use \`/welcome view\` to check current configuration.`;
    if (embedValue1) embed.setDescription(embedValue1);
    return safeReply(interaction, { embeds: [embed] });
  }
};


