const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");

const { safeReply, safeDeferReply } = require("../../utils/interactionResponder");
const EMOJIS = require("../../utils/emoji.json");
const Schema = require("../../schema/welcome");
const {
  normalizeWelcomeColor,
  renderWelcomeTemplate,
  welcomeVariablesText
} = require("../../welcome/template");

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
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) return safeReply(interaction, { content: "Failed to process this interaction." });

    const sub = interaction.options.getSubcommand();
    const { guildId, guild } = interaction;

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
          ...(resolvedColor ? { embedColor: resolvedColor } : {})
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
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
        { upsert: true, new: true, setDefaultsOnInsert: true }
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
        { upsert: true, new: true, setDefaultsOnInsert: true }
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
        { upsert: true, new: true, setDefaultsOnInsert: true }
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
        { upsert: true, new: true, setDefaultsOnInsert: true }
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
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Auto Role Cleared`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} Auto-role assignment has been disabled.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "view") {
      const data = await Schema.findOne({ guildID: guildId });
      if (!data) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("info")} Welcome Not Configured`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = "Use `/welcome setup` to configure it.";
        if (embedValue1) embed.setDescription(embedValue1);
        return safeReply(interaction, { embeds: [embed] });
      }

      const channel = data.channelID ? guild.channels.cache.get(data.channelID) : null;
      const role = data.roleID ? guild.roles.cache.get(data.roleID) : null;
      const color = data.embedColor || client.embedColor;

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("server")} Welcome Settings`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = "Current welcome system configuration.";
      if (embedValue1) embed.setDescription(embedValue1);
      var embedValue2 = [
      statField("Status", data.enabled ? "`Enabled`" : "`Disabled`", data.enabled ? "success" : "error"),
      statField("Channel", channel ? `<#${channel.id}>` : "`Not set`", "server"),
      statField("Auto Role", role ? `<@&${role.id}>` : "`Not set`", "users"),
      statField("Color", `\`${color}\``, "info"),
      { name: `${getEmoji("info")} Title`, value: `\`${data.title || "Welcome!"}\``, inline: false },
      { name: `${getEmoji("info")} Message`, value: `\`${data.message || "Welcome {user} to {server}!"}\``, inline: false },
      { name: `${getEmoji("info")} Variables`, value: welcomeVariablesText(), inline: false }
      ];
      if (Array.isArray(embedValue2) && embedValue2.length > 0) embed.addFields(embedValue2);
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

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Test Sent`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} Welcome preview sent to <#${channel.id}>.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("status");
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { enabled },
        { upsert: true, new: true, setDefaultsOnInsert: true }
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


