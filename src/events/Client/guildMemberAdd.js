const { EmbedBuilder } = require("discord.js");

const Schema = require("../../schema/welcome.js");
const {
  DEFAULT_WELCOME_EMBED_MESSAGE,
  DEFAULT_WELCOME_TEXT_MESSAGE,
  DEFAULT_WELCOME_TITLE,
  renderWelcomeTemplate,
} = require("../../welcome/template");

module.exports = async (client, member) => {
  try {
    const data = await Schema.findOne({ guildID: member.guild.id });
    if (!data || !data.enabled) return;

    if (data.roleID) {
      try {
        const role = member.guild.roles.cache.get(data.roleID);
        const botMember = member.guild.members.me;

        if (role && botMember && botMember.permissions.has("ManageRoles") && role.position < botMember.roles.highest.position) {
          await member.roles.add(role).catch(() => {});
        }
      } catch (err) {
        client.logger?.log?.(`Welcome role assign failed in ${member.guild.id}: ${err?.message || err}`, "warn");
      }
    }

    if (!data.channelID) return;
    let channel = member.guild.channels.cache.get(data.channelID);
    if (!channel && typeof member.guild.channels?.fetch === "function") {
      channel = await member.guild.channels.fetch(data.channelID).catch(() => null);
    }
    if (!channel || !channel.isTextBased()) return;

    const botMember = member.guild.members.me;
    const permissions = channel.permissionsFor(botMember);
    if (permissions && !permissions.has("SendMessages")) return;

    const embedDescription = renderWelcomeTemplate(data.message, member, DEFAULT_WELCOME_EMBED_MESSAGE);
    const textDescription = renderWelcomeTemplate(data.textMessage, member, DEFAULT_WELCOME_TEXT_MESSAGE);
    const embedEnabled = data.embedEnabled !== false; // default true
    const textEnabled = Boolean(data.textEnabled);

    // Send text message if enabled
    if (textEnabled) {
      await channel.send({ content: textDescription }).catch(() => {});
    }

    // Send embed if enabled
    if (embedEnabled) {
      if (permissions && !permissions.has("EmbedLinks")) {
        // Fallback to text if no embed permission
        await channel.send({ content: textDescription }).catch(() => {});
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(data.embedColor || client.embedColor || "#ff0051")
        .setTitle(data.title || DEFAULT_WELCOME_TITLE)
        .setDescription(embedDescription)
        .setThumbnail(member.user.displayAvatarURL({ forceStatic: false, size: 1024 }))
        .setFooter({ text: `Member #${member.guild.memberCount}` });

      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    client.logger?.log?.(`guildMemberAdd welcome error in ${member.guild.id}: ${err?.stack || err?.message || err}`, "error");
  }
};
