const { EmbedBuilder } = require("discord.js");

const Schema = require("../../schema/welcome.js");
const {
  DEFAULT_WELCOME_TITLE,
  renderWelcomeTemplate,
} = require("../../welcome/template");

function formatWelcomePlainFallback(title, description) {
  const safeTitle = String(title || "").trim();
  const safeDescription = String(description || "").trim();
  if (!safeTitle) return safeDescription;
  if (!safeDescription) return `**${safeTitle}**`;
  return `**${safeTitle}**\n${safeDescription}`;
}

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
    if (permissions && !permissions.has("SendMessages")) {
      client.logger?.log?.(`Welcome send skipped in ${member.guild.id}: missing SendMessages in ${data.channelID}.`, "warn");
      return;
    }

    const hasEmbedTemplate = Boolean(String(data.message || "").trim());
    const hasTextTemplate = Boolean(String(data.textMessage || "").trim());
    if (!hasEmbedTemplate && !hasTextTemplate) return;

    const embedDescription = hasEmbedTemplate
      ? renderWelcomeTemplate(data.message, member, "")
      : "";
    const textDescription = hasTextTemplate
      ? renderWelcomeTemplate(data.textMessage, member, "")
      : "";

    if (hasTextTemplate) {
      await channel.send({ content: textDescription }).catch(() => {});
    }

    if (hasEmbedTemplate) {
      if (permissions && !permissions.has("EmbedLinks")) {
        if (!hasTextTemplate) {
          const fallbackContent = formatWelcomePlainFallback(data.title || DEFAULT_WELCOME_TITLE, embedDescription);
          await channel.send({ content: fallbackContent }).catch(() => {});
        } else {
          client.logger?.log?.(`Welcome embed skipped in ${member.guild.id}: missing EmbedLinks in ${data.channelID}.`, "warn");
        }
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
