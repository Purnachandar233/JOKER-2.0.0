const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");

const { safeReply, safeDeferReply } = require("../../utils/safeReply");
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
    const createEmbed = ({ title, description, fields, author, thumbnail, image, footer, timestamp = false }) => {
      const embed = new EmbedBuilder().setColor(embedColor);
      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description);
      if (Array.isArray(fields) && fields.length > 0) embed.addFields(fields);
      if (author) embed.setAuthor(author);
      if (thumbnail) embed.setThumbnail(thumbnail);
      if (image) embed.setImage(image);
return embed;
    };
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
        const embed = createEmbed({
          title: `${getEmoji("error")} Invalid Channel`,
          description: `${no} Please choose a text-based channel.`
        });
        return safeReply(interaction, { embeds: [embed] });
      }
      if (requestedColor && !resolvedColor) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Invalid Color`,
          description: `${no} Use hex format like \`#ff0051\` or \`default\`.`
        });
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

      const embed = createEmbed({
        title: `${getEmoji("success")} Welcome Configured`,
        description: `${ok} Welcome system configured and enabled.`,
        fields: [
          statField("Channel", `<#${channel.id}>`, "server"),
          statField("Status", "`Enabled`", "success"),
          { name: `${getEmoji("info")} Message`, value: `\`${template}\``, inline: false }
        ]
      });
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "message") {
      const text = interaction.options.getString("text");
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { message: text },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const embed = createEmbed({
        title: `${getEmoji("success")} Welcome Message Updated`,
        description: `${ok} New welcome template saved.`,
        fields: [{ name: `${getEmoji("info")} Template`, value: `\`${text}\``, inline: false }]
      });
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "title") {
      const title = interaction.options.getString("text").slice(0, 256);
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { title },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const embed = createEmbed({
        title: `${getEmoji("success")} Welcome Title Updated`,
        description: `${ok} New title set to \`${title}\`.`
      });
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "color") {
      const rawColor = interaction.options.getString("value");
      const parsed = normalizeWelcomeColor(rawColor, client.embedColor);
      if (!parsed) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Invalid Color`,
          description: `${no} Use hex format like \`#ff0051\` or \`default\`.`
        });
        return safeReply(interaction, { embeds: [embed] });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { embedColor: parsed },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const embed = createEmbed({
        title: `${getEmoji("success")} Welcome Color Updated`,
        description: `${ok} Welcome embed color set to \`${parsed}\`.`
      });
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "role") {
      const role = interaction.options.getRole("role");
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { roleID: role.id },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const embed = createEmbed({
        title: `${getEmoji("success")} Auto Role Updated`,
        description: `${ok} New members will receive <@&${role.id}>.`
      });
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "clearrole") {
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { roleID: null },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const embed = createEmbed({
        title: `${getEmoji("success")} Auto Role Cleared`,
        description: `${ok} Auto-role assignment has been disabled.`
      });
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "view") {
      const data = await Schema.findOne({ guildID: guildId });
      if (!data) {
        const embed = createEmbed({
          title: `${getEmoji("info")} Welcome Not Configured`,
          description: "Use `/welcome setup` to configure it."
        });
        return safeReply(interaction, { embeds: [embed] });
      }

      const channel = data.channelID ? guild.channels.cache.get(data.channelID) : null;
      const role = data.roleID ? guild.roles.cache.get(data.roleID) : null;
      const color = data.embedColor || client.embedColor;

      const embed = createEmbed({
        title: `${getEmoji("server")} Welcome Settings`,
        description: "Current welcome system configuration.",
        fields: [
          statField("Status", data.enabled ? "`Enabled`" : "`Disabled`", data.enabled ? "success" : "error"),
          statField("Channel", channel ? `<#${channel.id}>` : "`Not set`", "server"),
          statField("Auto Role", role ? `<@&${role.id}>` : "`Not set`", "users"),
          statField("Color", `\`${color}\``, "info"),
          { name: `${getEmoji("info")} Title`, value: `\`${data.title || "Welcome!"}\``, inline: false },
          { name: `${getEmoji("info")} Message`, value: `\`${data.message || "Welcome {user} to {server}!"}\``, inline: false },
          { name: `${getEmoji("info")} Variables`, value: welcomeVariablesText(), inline: false }
        ]
      });
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "test") {
      const data = await Schema.findOne({ guildID: guildId });
      if (!data?.channelID) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Welcome Not Configured`,
          description: `${no} Configure it first using \`/welcome setup\`.`
        });
        return safeReply(interaction, { embeds: [embed] });
      }

      const channel = guild.channels.cache.get(data.channelID);
      if (!channel || !channel.isTextBased()) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Invalid Welcome Channel`,
          description: `${no} Configured channel does not exist or is not text-based.`
        });
        return safeReply(interaction, { embeds: [embed] });
      }

      const previewMember = guild.members.cache.get(interaction.user.id) || interaction.member;
      const preview = renderWelcomeTemplate(data.message, previewMember);
      const testEmbed = createEmbed({
        title: data.title || "Welcome!",
        description: preview,
        thumbnail: interaction.user.displayAvatarURL({ forceStatic: false }),
        footer: `Member #${guild.memberCount}`
      }).setColor(data.embedColor || client.embedColor);

      await channel.send({ embeds: [testEmbed] }).catch(() => {});

      const embed = createEmbed({
        title: `${getEmoji("success")} Test Sent`,
        description: `${ok} Welcome preview sent to <#${channel.id}>.`
      });
      return safeReply(interaction, { embeds: [embed] });
    }

    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("status");
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { enabled },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const embed = createEmbed({
        title: enabled
          ? `${getEmoji("success")} Welcome Enabled`
          : `${getEmoji("error")} Welcome Disabled`,
        description: enabled
          ? `${ok} New members will receive welcome messages.`
          : `${ok} Welcome messages are disabled.`
      });
      return safeReply(interaction, { embeds: [embed] });
    }

    const embed = createEmbed({
      title: `${getEmoji("error")} Invalid Subcommand`,
      description: `${no} Use \`/welcome view\` to check current configuration.`
    });
    return safeReply(interaction, { embeds: [embed] });
  }
};

