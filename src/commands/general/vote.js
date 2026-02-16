const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "vote",
  category: "general",
  description: "Vote for Joker Music.",
  owner: false,
  wl: true,
  execute: async (message, args, client) => {
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
    const createLinkRow = () => {
      const support = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Support").setURL("https://discord.gg/JQzBqgmwFm");
      const invite = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Invite").setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`);
      const vote = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Vote").setURL(`https://top.gg/bot/${client.user.id}/vote`);
      const supportEmoji = getEmoji("support");
      const inviteEmoji = getEmoji("invite");
      const voteEmoji = getEmoji("vote");
      try { if (supportEmoji) support.setEmoji(supportEmoji); } catch (_e) {}
      try { if (inviteEmoji) invite.setEmoji(inviteEmoji); } catch (_e) {}
      try { if (voteEmoji) vote.setEmoji(voteEmoji); } catch (_e) {}
      return new ActionRowBuilder().addComponents(support, invite, vote);
    };

    const embed = createEmbed({
      title: `${getEmoji("vote")} Support Joker Music`,
      description: [
        "Vote on bot listing platforms to support development.",
        "",
        "Voting can unlock premium-style access windows in some commands."
      ].join("\n"),
      footer: `${getEmoji("vote")} Thanks for supporting the joker`
    });

    return message.channel.send({ embeds: [embed], components: [createLinkRow()] });
  }
};

