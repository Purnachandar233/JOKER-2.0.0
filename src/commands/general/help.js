const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { buildPrefixHelpFields } = require("../../utils/helpCatalog");

const EMOJIS = require("../../utils/emoji.json");

module.exports = {
  name: "help",
  category: "general",
  description: "Shows the help menu and command list.",
  wl: true,
  execute: async (message, args, client, prefix) => {
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

    const query = args.join(" ").trim().toLowerCase();

    if (!query) {
      const categories = buildPrefixHelpFields(client, getEmoji);

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription([
          `Use \`${prefix}help <command>\` for detailed usage.`,
          `You can also use slash commands with \`/help\`.`
        ].join("\n"))
        .setAuthor({ name: "Joker Music Help Menu", iconURL: message.member.displayAvatarURL({ forceStatic: false }) }); 
        
        
      if (categories.length > 0) embed.addFields(categories);
      return message.channel.send({ embeds: [embed], components: [linkRow, legalRow] });
    }

    const command = client.commands.get(query) || client.commands.get(client.aliases.get(query));
    if (!command) {
      const notFound = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Command Not Found`)
        .setDescription(`No command matched \`${query}\`. Try \`${prefix}help\` for a full list.`)
return message.channel.send({ embeds: [notFound] });
    }

    const detail = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("info")} ${command.name} Command`)
      .setDescription(command.description || "No description provided.")
      .addFields(
        {
          name: `${getEmoji("search")} Usage`,
          value: `\`${prefix}${command.name}${command.usage ? ` ${command.usage}` : ""}\``,
          inline: false
        },
        {
          name: `${getEmoji("queue")} Aliases`,
          value: command.aliases && command.aliases.length ? `\`${command.aliases.join("` `")}\`` : "`None`",
          inline: false
        }
      )
return message.channel.send({ embeds: [detail] });
  }
};


