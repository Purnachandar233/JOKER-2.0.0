const { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { readdirSync, statSync } = require("fs");
const path = require("path");
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
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    
    let ok = client.emoji.ok;
    let no = client.emoji.no;

    const em = interaction.options.getString("command");
    if (!em) {
      let categories = [];
      
      // Helper function to recursively get all .js files
      const getAllCommandFiles = (dir) => {
        let files = [];
        const items = readdirSync(dir);
        for (const item of items) {
          const filePath = path.join(dir, item);
          const stat = statSync(filePath);
          if (stat.isDirectory()) {
            files = files.concat(getAllCommandFiles(filePath));
          } else if (item.endsWith('.js')) {
            files.push({ fullPath: filePath, name: item });
          }
        }
        return files;
      };
      
      readdirSync("./src/commands/").forEach((dir) => {
        if (dir === "owner") return;
        
        const allFiles = getAllCommandFiles(path.join("./src/commands/", dir));
        
        const cmds = allFiles.map((file) => {
          try {
            // Use require with the full path relative to the current file
            let fileContent = require(path.resolve(file.fullPath));
            if (!fileContent.name) return null;
            let name = fileContent.name.replace(".js", "");
            return `\`${name}\``;
          } catch (err) {
            return null;
          }
        }).filter(cmd => cmd !== null);

        if (cmds.length > 0) {
          categories.push({
            name: `${dir} [${cmds.length}]`,
            value: cmds.join(", "),
          });
        }
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Support Server")
          .setStyle(5)
          .setURL(`https://discord.gg/JQzBqgmwFm`),
        new ButtonBuilder()
          .setLabel("Invite Me")
          .setStyle(5)
          .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`),
        new ButtonBuilder()
          .setLabel("Vote")
          .setStyle(5)
          .setURL(`https://top.gg/bot/${client.user.id}/vote`)
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