const { EmbedBuilder } = require("discord.js");

const Schema = require("../../schema/welcome");
const EMOJIS = require("../../utils/emoji.json");
const {
  normalizeWelcomeColor,
  renderWelcomeTemplate,
  welcomeVariablesText
} = require("../../welcome/template");

function isOn(value) {
  return ["on", "true", "enable", "enabled", "yes"].includes(String(value || "").toLowerCase());
}

module.exports = {
  name: "welcome",
  category: "settings",
  aliases: ["welcomeset", "welcomeconfig"],
  description: "Configure welcome messages for your server.",
  userPermissions: ["Administrator"],
  execute: async (message, args, client, prefix) => {
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
    const sub = String(args[0] || "").toLowerCase();
    const { guildId, guild, author } = message;

    if (!sub) {
      const embed = createEmbed({
        title: `${getEmoji("server")} Welcome System`,
        description: "Configure welcome message channel, template, role, and status.",
        fields: [
          { name: "Setup", value: `\`${prefix}welcome setup <#channel> [message]\``, inline: false },
          { name: "Message", value: `\`${prefix}welcome message <message>\``, inline: false },
          { name: "Title", value: `\`${prefix}welcome title <text>\``, inline: false },
          { name: "Color", value: `\`${prefix}welcome color <hex|default>\``, inline: false },
          { name: "Role", value: `\`${prefix}welcome role <@role>\``, inline: true },
          { name: "Clear Role", value: `\`${prefix}welcome clearrole\``, inline: true },
          { name: "Toggle", value: `\`${prefix}welcome toggle <on/off>\``, inline: true },
          { name: "View", value: `\`${prefix}welcome view\``, inline: true },
          { name: "Test", value: `\`${prefix}welcome test\``, inline: true },
          { name: "Variables", value: welcomeVariablesText(), inline: false }
        ]
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "setup") {
      const channel = message.mentions.channels.first() || guild.channels.cache.get(args[1]);
      const template = args.slice(2).join(" ").trim() || "Welcome {user} to {server}!";

      if (!channel || !channel.isTextBased()) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Invalid Channel`,
          description: `${no} Usage: \`${prefix}welcome setup <#channel> [message]\``
        });
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        {
          channelID: channel.id,
          message: template,
          enabled: true
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const embed = createEmbed({
        title: `${getEmoji("success")} Welcome Configured`,
        description: `${ok} Welcome system is now configured and enabled.`,
        fields: [
          statField("Channel", `<#${channel.id}>`, "server"),
          statField("Status", "`Enabled`", "success"),
          { name: `${getEmoji("info")} Message`, value: `\`${template}\``, inline: false }
        ]
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "message") {
      const template = args.slice(1).join(" ").trim();
      if (!template) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Missing Message`,
          description: `${no} Usage: \`${prefix}welcome message <message>\``
        });
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { message: template },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const embed = createEmbed({
        title: `${getEmoji("success")} Welcome Message Updated`,
        description: `${ok} New template saved.`,
        fields: [{ name: `${getEmoji("info")} Template`, value: `\`${template}\``, inline: false }]
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "title") {
      const title = args.slice(1).join(" ").trim();
      if (!title) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Missing Title`,
          description: `${no} Usage: \`${prefix}welcome title <text>\``
        });
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { title: title.slice(0, 256) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const embed = createEmbed({
        title: `${getEmoji("success")} Welcome Title Updated`,
        description: `${ok} New title set to \`${title.slice(0, 256)}\`.`
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "color") {
      const rawColor = args[1];
      if (!rawColor) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Missing Color`,
          description: `${no} Usage: \`${prefix}welcome color <hex|default>\``
        });
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      const parsed = normalizeWelcomeColor(rawColor, client.embedColor);
      if (!parsed) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Invalid Color`,
          description: `${no} Use hex format like \`#ff0051\` or \`default\`.`
        });
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
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
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "role") {
      const role = message.mentions.roles.first() || guild.roles.cache.get(args[1]);
      if (!role) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Invalid Role`,
          description: `${no} Usage: \`${prefix}welcome role <@role>\``
        });
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { roleID: role.id },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const embed = createEmbed({
        title: `${getEmoji("success")} Auto Role Updated`,
        description: `${ok} New members will receive <@&${role.id}>.`
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
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
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "view") {
      const data = await Schema.findOne({ guildID: guildId });
      if (!data) {
        const embed = createEmbed({
          title: `${getEmoji("info")} Welcome Not Configured`,
          description: `Use \`${prefix}welcome setup\` to configure it.`
        });
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
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
          { name: `${getEmoji("info")} Message`, value: `\`${data.message || "Welcome {user} to {server}!"}\``, inline: false }
        ]
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "test") {
      const data = await Schema.findOne({ guildID: guildId });
      if (!data?.channelID) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Welcome Not Configured`,
          description: `${no} Configure it first using \`${prefix}welcome setup\`.`
        });
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      const channel = guild.channels.cache.get(data.channelID);
      if (!channel || !channel.isTextBased()) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Invalid Welcome Channel`,
          description: `${no} The configured channel does not exist or is not text-based.`
        });
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      const preview = renderWelcomeTemplate(data.message, message.member);
      const testEmbed = createEmbed({
        title: data.title || "Welcome!",
        description: preview,
        thumbnail: author.displayAvatarURL({ forceStatic: false }),
        footer: `Member #${guild.memberCount}`
      }).setColor(data.embedColor || client.embedColor);

      await channel.send({ embeds: [testEmbed] }).catch(() => {});

      const embed = createEmbed({
        title: `${getEmoji("success")} Test Sent`,
        description: `${ok} Welcome preview sent to <#${channel.id}>.`
      });
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "toggle") {
      const statusArg = args[1];
      if (!statusArg) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Missing Toggle Value`,
          description: `${no} Usage: \`${prefix}welcome toggle <on/off>\``
        });
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      const enabled = isOn(statusArg);
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
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    const embed = createEmbed({
      title: `${getEmoji("error")} Invalid Subcommand`,
      description: `${no} Use \`${prefix}welcome\` to see available options.`
    });
    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};

