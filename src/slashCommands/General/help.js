const { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { readdirSync } = require("fs");
const prefix = require("../../../config.json").prefix;

module.exports = {
  name: "help",
  description: "Show All Commands",
  options: [
    {
      name: "command",
      description: "the command that you want to view info on",
      required: false,
      type: 3 // STRING type
    }
  ],
  wl: true,
  run: async (client, interaction, args) => {
    let ok = client.emoji.ok;
    let no = client.emoji.no;

    const em = interaction.options.getString("command");
    if (!em) {
      let categories = [];
      readdirSync("./src/commands/").forEach((dir) => {
        const commands = readdirSync(`./src/commands/${dir}/`).filter((file) =>
          file.endsWith(".js")
        );
        if (dir === "owner") return;
        const cmds = commands.map((command) => {
          let file = require(`../../commands/${dir}/${command}`);
          if (!file.name) return "No command name.";
          let name = file.name.replace(".js", "");
          return `\`${name}\``;
        });

        categories.push({
          name: `${dir} [${cmds.length}]`,
          value: cmds.length === 0 ? "In progress." : cmds.join(", "),
        });
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Support Server")
          .setStyle(5)
          .setURL(`https://discord.gg/pCj2UBbwST`),
        new ButtonBuilder()
          .setLabel("Invite Me")
          .setStyle(5)
          .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`),
        new ButtonBuilder()
          .setLabel("Vote")
          .setStyle(5)
          .setURL(`https://top.gg/bot/898941398538158080/vote`)
      );

      const embed = new EmbedBuilder()
        .addFields(categories)
        .setAuthor({ name: `${client.user.username} Commands`, iconURL: client.user.displayAvatarURL({ forceStatic: false }) })
        .setDescription(`Alex is the easiest way to play music in your Discord server. It supports Spotify, YouTube, Soundcloud and more!`)
        .setColor(interaction.client?.embedColor || '#ff0051');

      return interaction.editReply({ embeds: [embed], components: [row] });
    } else {
      const command = client.sls.get(em);
      if (!command) {
        const embed = new EmbedBuilder()
          .setDescription(`Couldn't find matching command name.`)
          .setColor(interaction.client?.embedColor || '#ff0051');
        return interaction.editReply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setDescription(`> Aliases: ${command.aliases ? `\`${command.aliases.join("` `")}\`` : "No aliases for this command."}\n> Usage: ${command.usage ? `\`${prefix}${command.name} ${command.usage}\`` : `not found`}\n> Description: ${command.description ? command.description : "No description for this command."}`)
        .setColor(interaction.client?.embedColor || '#ff0051');
      return interaction.editReply({ embeds: [embed] });
    }
  },
};