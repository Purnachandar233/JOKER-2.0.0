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
    const legal = client?.legalLinks || {};

    const support = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Support")
      .setURL(legal.supportServerUrl);

    const invite = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Invite")
      .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`);

    const vote = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Vote")
      .setURL(`https://top.gg/bot/${client.user.id}/vote`);

    const privacy = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Privacy")
      .setURL(legal.privacyPolicyUrl);

    const terms = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Terms")
      .setURL(legal.termsOfServiceUrl);

    const supportEmoji = getEmoji("support");
    const inviteEmoji = getEmoji("invite");
    const voteEmoji = getEmoji("vote");
    try { if (supportEmoji) support.setEmoji(supportEmoji); } catch (_e) {}
    try { if (inviteEmoji) invite.setEmoji(inviteEmoji); } catch (_e) {}
    try { if (voteEmoji) vote.setEmoji(voteEmoji); } catch (_e) {}

    const linkRow = new ActionRowBuilder().addComponents(support, invite, vote);
    const legalRow = new ActionRowBuilder().addComponents(privacy, terms);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({ name: "Invite!", iconURL: client.user.displayAvatarURL({ forceStatic: false, size: 256 }) })
      .setDescription(
        [
          "Hey, looking to invite **JOKER** to your server?",
          `Use the button below or [CLICK HERE](https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands).`,
          `**[Support Server](${legal.supportServerUrl})**`,
          `**[Vote for us](https://top.gg/bot/${client.user.id}/vote)**`
        ].join("\n")
      )
      .setFooter({ text: "Thank you for using Joker" });

    return message.channel.send({ embeds: [embed], components: [linkRow, legalRow] });
  }
};


