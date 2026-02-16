const { EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
const EMBED_COLOR = "#ff0051";

function getEmoji(client, key, fallback = "") {
  return EMOJIS[key] || fallback;
}

function createEmbed(client, options = {}) {
  const {
    title,
    description,
    fields,
    author,
    thumbnail,
    image,
    footer,
    timestamp = false
  } = options;

  const embed = new EmbedBuilder().setColor(client?.embedColor || EMBED_COLOR);

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (Array.isArray(fields) && fields.length > 0) embed.addFields(fields);
  if (author) embed.setAuthor(author);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);

  const footerText = footer || `${getEmoji(client, "music", "[M]")} Joker Music`;
return embed;
}

const Schema = require("../../schema/welcome.js");
const { renderWelcomeTemplate } = require("../../welcome/template");

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
    const channel = member.guild.channels.cache.get(data.channelID);
    if (!channel || !channel.isTextBased()) return;

    const description = renderWelcomeTemplate(data.message, member);
    const embed = createEmbed(client, {
      title: data.title || `${getEmoji(client, "success")} Welcome!`,
      description,
      thumbnail: member.user.displayAvatarURL({ forceStatic: false, size: 1024 }),
      footer: `Member #${member.guild.memberCount}`
    }).setColor(data.embedColor || client.embedColor || "#ff0051");

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    client.logger?.log?.(`guildMemberAdd welcome error in ${member.guild.id}: ${err?.stack || err?.message || err}`, "error");
  }
};

