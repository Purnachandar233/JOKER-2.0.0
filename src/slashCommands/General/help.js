const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const { buildSlashHelpFields } = require("../../utils/helpCatalog");

const EMOJIS = require("../../utils/emoji.json");

module.exports = {
  name: "help",
  description: "Show all commands",
  options: [
    {
      name: "command",
      description: "Command name for detailed info",
      required: false,
      type: 3
    }
  ],
  wl: true,
  run: async (client, interaction) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const legal = client?.legalLinks || {};
    const support = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Support").setURL(legal.supportServerUrl);
    const invite = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Invite").setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`);
    const vote = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Vote").setURL(`https://top.gg/bot/${client.user.id}/vote`);
    const privacy = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Privacy").setURL(legal.privacyPolicyUrl);
    const terms = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Terms").setURL(legal.termsOfServiceUrl);
    const supportEmoji = getEmoji("support");
    const inviteEmoji = getEmoji("invite");
    const voteEmoji = getEmoji("vote");
    try { if (supportEmoji) support.setEmoji(supportEmoji); } catch (_e) {}
    try { if (inviteEmoji) invite.setEmoji(inviteEmoji); } catch (_e) {}
    try { if (voteEmoji) vote.setEmoji(voteEmoji); } catch (_e) {}
    const linkRow = new ActionRowBuilder().addComponents(support, invite, vote);
    const legalRow = new ActionRowBuilder().addComponents(privacy, terms);


    await interaction.deferReply({ ephemeral: false }).catch(() => {});

    const query = (interaction.options.getString("command") || "").trim().toLowerCase().replace(/^\//, "");

    if (!query) {
      const categories = buildSlashHelpFields(client, getEmoji);
      const activePrefix = client?.prefix || "=";

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription([
          `Use \`${activePrefix}help <command>\` for prefix command details.`,
          "Use this slash command with `/help command:<name>` for slash details."
        ].join("\n"))
        .setAuthor({
          name: "Joker Help Menu",
          iconURL: client.user.displayAvatarURL({ forceStatic: false })
        });
      if (categories.length > 0) embed.addFields(categories);
      embed.setFooter({ text: `${getEmoji("support")} Command Navigator` });

      return interaction.editReply({ embeds: [embed], components: [linkRow, legalRow] });
    }

    const command = client.sls.get(query);
    if (!command) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Command Not Found`)
        .setDescription(`No slash command matched \`${query}\`.`);
      return interaction.editReply({ embeds: [embed] });
    }

    const detail = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${getEmoji("info")} /${command.name}`)
      .setDescription(command.description || "No description provided.")
      .addFields(
        {
          name: `${getEmoji("queue")} Aliases`,
          value: command.aliases?.length ? `\`${command.aliases.join("` `")}\`` : "`None`",
          inline: false
        },
        {
          name: `${getEmoji("search")} Usage`,
          value: command.usage ? `\`${command.usage}\`` : "`No usage metadata`",
          inline: false
        }
      )
      .setFooter({ text: `${getEmoji("music")} Slash Command Detail` });

    return interaction.editReply({ embeds: [detail] });
  }
};


