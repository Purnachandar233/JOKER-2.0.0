const { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { readdirSync } = require("fs");
const path = require("path");

module.exports = {
  name: "help",
  category: "general",
  description: "Shows the help menu / commands list of the bot. ",
  wl: true,
  execute: async (message, args, client, prefix) => {
    const em = args.join(" ");
    if (!em) {
      let categories = [];
      const commandsDir = path.join(__dirname, "../../commands");
      
      readdirSync(commandsDir).forEach((dir) => {
        const dirPath = path.join(commandsDir, dir);
        try {
          const stats = require("fs").statSync(dirPath);
          if (!stats.isDirectory()) return;
        } catch (e) { return; }

        const commands = readdirSync(dirPath).filter((file) =>
          file.endsWith(".js")
        );
        
        if (dir === "owner") return;
        
        const cmds = commands.map((command) => {
          try {
            const file = require(path.join(dirPath, command));
            if (!file.name) return null;
            return `\`${file.name.toLowerCase()}\``;
          } catch (e) {
            return null;
          }
        }).filter(Boolean);

        if (cmds.length > 0) {
          categories.push({
            name: `✧ ${dir.charAt(0).toUpperCase() + dir.slice(1)}`,
            value: `┕ ${cmds.join(", ")}`,
          });
        }
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Support")
          .setStyle(5)
          .setURL(`https://discord.gg/pCj2UBbwST`),
        new ButtonBuilder()
          .setLabel("Invite")
          .setStyle(5)
          .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`),
        new ButtonBuilder()
          .setLabel("Vote")
          .setStyle(5)
          .setURL(`https://top.gg/bot/${client.user.id}/vote`)
      );

      const embed = new EmbedBuilder()
        .setTitle(`Joker Music Command Menu`)
        .addFields(categories)
        .setFooter({ text: "Joker Music Team", iconURL: client.user.displayAvatarURL() })
        .setAuthor({ name: `Command Palette`, iconURL: client.user.displayAvatarURL({ forceStatic: false }) })
        .setDescription(`*Explore the symphony of commands. Type \`${prefix}help <command>\` for details.*`)
        .setColor(0xff0051);

      message.channel.send({ embeds: [embed], components: [row] });
    } else {
      const command = client.commands.get(em.toLowerCase()) || client.commands.get(client.aliases.get(em.toLowerCase()));
      if (!command) {
        const embed = new EmbedBuilder()
          .setDescription(`*No command found matching your request.*`)
          .setColor(0xff0051);
        return message.channel.send({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setTitle(`Command Details: ${command.name}`)
        .setDescription(`> **Aliases**: ${command.aliases ? `\`${command.aliases.join("` `")}\`` : "None"}\n> **Usage**: \`${prefix}${command.name} ${command.usage || ""}\`\n> **Description**: *${command.description || "No description provided."}*`)
        .setColor(0xff0051);
      return message.channel.send({ embeds: [embed] });
    }
  },
};
