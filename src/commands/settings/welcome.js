const { EmbedBuilder, MessageFlags } = require("discord.js");

const Schema = require("../../schema/welcome");
const EMOJIS = require("../../utils/emoji.json");
const {
  DEFAULT_WELCOME_EMBED_MESSAGE,
  DEFAULT_WELCOME_TEXT_MESSAGE,
  DEFAULT_WELCOME_TITLE,
  normalizeWelcomeColor,
  renderWelcomeTemplate
} = require("../../welcome/template");
const { buildWelcomeSetupPanel } = require("../../welcome/panel");

function isOn(value) {
  return ["on", "true", "enable", "enabled", "yes"].includes(String(value || "").toLowerCase());
}

function isOff(value) {
  return ["off", "false", "disable", "disabled", "no"].includes(String(value || "").toLowerCase());
}

module.exports = {
  name: "welcome",
  category: "settings",
  aliases: ["welcomeset", "welcomeconfig"],
  description: "Configure welcome messages for your server.",
  userPermissions: ["Administrator"],
  execute: async (message, args, client, prefix) => {
    if (!message.member.permissions.has("ManageGuild") && !message.member.permissions.has("Administrator")) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || "#ff0051")
        .setDescription("*You need the `Manage Server` or `Administrator` permission to configure the welcome system.*");
      return message.channel.send({ embeds: [noperms] });
    }

    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const statField = (label, value, emojiKey, inline = true) => ({
      name: `${emojiKey ? `${getEmoji(emojiKey)} ` : ""}${label}`,
      value: String(value),
      inline
    });

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const sub = String(args[0] || "").toLowerCase();
    const { guildId, guild, author } = message;
    const sendSetupPanel = async () => {
      const data = await Schema.findOne({ guildID: guildId }).lean().catch(() => null);
      const components = buildWelcomeSetupPanel({
        data,
        guild,
        embedColor,
        prefix,
        slash: false,
      });

      try {
        const panelMsg = await message.reply({
          flags: MessageFlags.IsComponentsV2,
          components,
          allowedMentions: { repliedUser: false },
        });

        return panelMsg;
      } catch (_err) {
        const fallback = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("server")} Welcome Setup`)
          .setDescription(
            `${ok} Use \`${prefix}welcome setup <#channel> [message]\` to configure.\n` +
            `Use \`${prefix}welcome textmessage <message>\` to add a text welcome.`
          );
        return message.reply({ embeds: [fallback], allowedMentions: { repliedUser: false } });
      }
    };

    if (!sub || sub === "panel") {
      return sendSetupPanel();
    }

    if (sub === "setup") {
      const channel = message.mentions.channels.first() || guild.channels.cache.get(args[1]);
      const template = args.slice(2).join(" ").trim() || DEFAULT_WELCOME_EMBED_MESSAGE;

      if (!channel || !channel.isTextBased()) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Invalid Channel`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Usage: \`${prefix}welcome setup <#channel> [message]\``;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        {
          channelID: channel.id,
          message: template,
          textMessage: null,
          title: DEFAULT_WELCOME_TITLE,
          enabled: true
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Welcome Configured`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} Welcome system is now configured and enabled.`;
      if (embedValue1) embed.setDescription(embedValue1);
      var embedValue2 = [
      statField("Channel", `<#${channel.id}>`, "server"),
      statField("Status", "`Enabled`", "success"),
      { name: `${getEmoji("info")} Embed Message`, value: `\`${template}\``, inline: false },
      { name: `${getEmoji("info")} Text Message`, value: "`Not set`", inline: false }
      ];
      if (Array.isArray(embedValue2) && embedValue2.length > 0) embed.addFields(embedValue2);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "message") {
      const template = args.slice(1).join(" ").trim();
      if (!template) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Missing Message`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Usage: \`${prefix}welcome message <message>\``;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { message: template },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Embed Message Updated`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} New template saved.`;
      if (embedValue1) embed.setDescription(embedValue1);
      var embedValue2 = [{ name: `${getEmoji("info")} Template`, value: `\`${template}\``, inline: false }];
      if (Array.isArray(embedValue2) && embedValue2.length > 0) embed.addFields(embedValue2);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "textmessage" || sub === "texttemplate") {
      const template = args.slice(1).join(" ").trim();
      if (!template) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Missing Text Message`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Usage: \`${prefix}welcome textmessage <message>\``;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { textMessage: template },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Text Message Updated`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} New text template saved.`;
      if (embedValue1) embed.setDescription(embedValue1);
      var embedValue2 = [{ name: `${getEmoji("info")} Template`, value: `\`${template}\``, inline: false }];
      if (Array.isArray(embedValue2) && embedValue2.length > 0) embed.addFields(embedValue2);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "title") {
      const title = args.slice(1).join(" ").trim();
      if (!title) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Missing Title`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Usage: \`${prefix}welcome title <text>\``;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { title: title.slice(0, 256) },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Welcome Title Updated`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} New title set to \`${title.slice(0, 256)}\`.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "color") {
      const rawColor = args[1];
      if (!rawColor) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Missing Color`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Usage: \`${prefix}welcome color <hex|default>\``;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      const parsed = normalizeWelcomeColor(rawColor, client.embedColor);
      if (!parsed) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Invalid Color`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Use hex format like \`#ff0051\` or \`default\`.`;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
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
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "role") {
      const role = message.mentions.roles.first() || guild.roles.cache.get(args[1]);
      if (!role) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Invalid Role`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Usage: \`${prefix}welcome role <@role>\``;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      await Schema.findOneAndUpdate(
        { guildID: guildId },
        { roleID: role.id },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Auto Role Updated`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} New members will receive <@&${role.id}>.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
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
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "clear") {
      await Schema.deleteMany({ guildID: guildId }).catch(() => {});
      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Welcome Data Cleared`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} All welcome settings for this server were deleted.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "view") {
      return sendSetupPanel();
    }

    if (sub === "test") {
      const data = await Schema.findOne({ guildID: guildId });
      if (!data?.channelID) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Welcome Not Configured`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Configure it first using \`${prefix}welcome setup\`.`;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      const channel = guild.channels.cache.get(data.channelID);
      if (!channel || !channel.isTextBased()) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Invalid Welcome Channel`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} The configured channel does not exist or is not text-based.`;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      const hasEmbedTemplate = Boolean(String(data.message || "").trim());
      const hasTextTemplate = Boolean(String(data.textMessage || "").trim());
      if (!hasEmbedTemplate && !hasTextTemplate) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} No Welcome Content`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Set an embed message or a text message first.`;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      if (hasTextTemplate) {
        const textPreview = renderWelcomeTemplate(data.textMessage, message.member, "");
        await channel.send({ content: textPreview }).catch(() => {});
      }

      if (hasEmbedTemplate) {
        const embedPreview = renderWelcomeTemplate(data.message, message.member, "");
        const testEmbed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = data.title || DEFAULT_WELCOME_TITLE;
        if (embedValue0) testEmbed.setTitle(embedValue0);
        var embedValue1 = embedPreview;
        if (embedValue1) testEmbed.setDescription(embedValue1);
        var embedValue2 = author.displayAvatarURL({ forceStatic: false });
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
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "textmsg") {
      const statusArg = args[1];
      if (!statusArg || (!isOn(statusArg) && !isOff(statusArg))) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Invalid Text Mode Value`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Usage: \`${prefix}welcome textmsg <on/off>\``;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      const status = isOn(statusArg);
      await Schema.findOneAndUpdate(
        { guildID: guildId },
        {
          textMessage: status ? DEFAULT_WELCOME_TEXT_MESSAGE : null
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Delivery Mode Updated`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = status
        ? `${ok} Default text welcome restored.`
        : `${ok} Text welcome removed.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "toggle") {
      const statusArg = args[1];
      if (!statusArg) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Missing Toggle Value`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Usage: \`${prefix}welcome toggle <on/off>\``;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      if (!isOn(statusArg) && !isOff(statusArg)) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("error")} Invalid Toggle Value`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `${no} Usage: \`${prefix}welcome toggle <on/off>\``;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      const enabled = isOn(statusArg);
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
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    const embed = new EmbedBuilder().setColor(embedColor);
    var embedValue0 = `${getEmoji("error")} Invalid Subcommand`;
    if (embedValue0) embed.setTitle(embedValue0);
    var embedValue1 = `${no} Use \`${prefix}welcome\` to see available options.`;
    if (embedValue1) embed.setDescription(embedValue1);
    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  }
};


