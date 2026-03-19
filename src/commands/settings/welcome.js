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
                    if (!message.member.permissions.has('ManageGuild') && !message.member.permissions.has('Administrator')) {
            const noperms = new EmbedBuilder()
                .setColor(message.client?.embedColor || '#ff0051')
                .setDescription('*You need the `Manage Server` or `Administrator` permission to change the prefix.*');
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

    if (!message.member.permissions.has('ADMINISTRATOR')) {
        const noperms = new EmbedBuilder()
       .setColor(message.client?.embedColor || '#ff0051')
       .setDescription(`You need this required Permissions: \`admin\` to run this command.`)
       return await message.channel.send({embeds: [noperms]});
    }

    if (!sub) {
      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("server")} Welcome System`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = "Configure welcome message channel, template, role, and status.";
      if (embedValue1) embed.setDescription(embedValue1);
      var embedValue2 = [
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
      ];
      if (Array.isArray(embedValue2) && embedValue2.length > 0) embed.addFields(embedValue2);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "setup") {
      const channel = message.mentions.channels.first() || guild.channels.cache.get(args[1]);
      const template = args.slice(2).join(" ").trim() || "Welcome {user} to {server}!";

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
          enabled: true
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Welcome Configured`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} Welcome system is now configured and enabled.`;
      if (embedValue1) embed.setDescription(embedValue1);
      var embedValue2 = [
      statField("Channel", `<#${channel.id}>`, "server"),
      statField("Status", "`Enabled`", "success"),
      { name: `${getEmoji("info")} Message`, value: `\`${template}\``, inline: false }
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
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Welcome Message Updated`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} New template saved.`;
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
        { upsert: true, new: true, setDefaultsOnInsert: true }
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
        { upsert: true, new: true, setDefaultsOnInsert: true }
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
        { upsert: true, new: true, setDefaultsOnInsert: true }
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
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Auto Role Cleared`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} Auto-role assignment has been disabled.`;
      if (embedValue1) embed.setDescription(embedValue1);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (sub === "view") {
      const data = await Schema.findOne({ guildID: guildId });
      if (!data) {
        const embed = new EmbedBuilder().setColor(embedColor);
        var embedValue0 = `${getEmoji("info")} Welcome Not Configured`;
        if (embedValue0) embed.setTitle(embedValue0);
        var embedValue1 = `Use \`${prefix}welcome setup\` to configure it.`;
        if (embedValue1) embed.setDescription(embedValue1);
        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
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
      { name: `${getEmoji("info")} Message`, value: `\`${data.message || "Welcome {user} to {server}!"}\``, inline: false }
      ];
      if (Array.isArray(embedValue2) && embedValue2.length > 0) embed.addFields(embedValue2);
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
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

      const preview = renderWelcomeTemplate(data.message, message.member);
      const testEmbed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = data.title || "Welcome!";
      if (embedValue0) testEmbed.setTitle(embedValue0);
      var embedValue1 = preview;
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

      const embed = new EmbedBuilder().setColor(embedColor);
      var embedValue0 = `${getEmoji("success")} Test Sent`;
      if (embedValue0) embed.setTitle(embedValue0);
      var embedValue1 = `${ok} Welcome preview sent to <#${channel.id}>.`;
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

      const enabled = isOn(statusArg);
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


