const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "invite",
  category: "general",
  description: "Get the bot invite link.",
  owner: false,
  wl: true,
  execute: async (message, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const support = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Support").setURL("https://discord.gg/JQzBqgmwFm");
    const invite = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Invite").setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`);
    const vote = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Vote").setURL(`https://top.gg/bot/${client.user.id}/vote`);
    const supportEmoji = getEmoji("support");
    const inviteEmoji = getEmoji("invite");
    const voteEmoji = getEmoji("vote");
    try { if (supportEmoji) support.setEmoji(supportEmoji); } catch (_e) {}
    try { if (inviteEmoji) invite.setEmoji(inviteEmoji); } catch (_e) {}
    try { if (voteEmoji) vote.setEmoji(voteEmoji); } catch (_e) {}
    const linkRow = new ActionRowBuilder().addComponents(support, invite, vote);


    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({ name: "Invite" }, client.user.displayAvatarURL({ forceStatic: false, size: 256 }))
      .setDescription("Use the buttons below to add Joker or join support.")
      .setFooter({ text: " Thank you for using Joker Music" });

    return message.channel.send({ embeds: [embed], components: [linkRow] });
  }
};
