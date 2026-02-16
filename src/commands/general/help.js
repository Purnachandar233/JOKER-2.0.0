const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { statSync, readdirSync } = require("fs");
const path = require("path");

const EMOJIS = require("../../utils/emoji.json");
function getAllCommandFiles(dir) {
  const files = [];
  const items = readdirSync(dir);
  for (const item of items) {
    const filePath = path.join(dir, item);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      files.push(...getAllCommandFiles(filePath));
    } else if (item.endsWith(".js")) {
      files.push(filePath);
    }
  }
  return files;
}

module.exports = {
  name: "help",
  category: "general",
  description: "Shows the help menu and command list.",
  wl: true,
  execute: async (message, args, client, prefix) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";

    const support = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Support")
      .setURL("https://discord.gg/JQzBqgmwFm");

    const invite = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Invite")
      .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=70510540062032&integration_type=0&scope=bot+applications.commands`);

    const vote = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Vote")
      .setURL(`https://top.gg/bot/${client.user.id}/vote`);

    const supportEmoji = getEmoji("support");
    const inviteEmoji = getEmoji("invite");
    const voteEmoji = getEmoji("vote");
    try { if (supportEmoji) support.setEmoji(supportEmoji); } catch (_e) {}
    try { if (inviteEmoji) invite.setEmoji(inviteEmoji); } catch (_e) {}
    try { if (voteEmoji) vote.setEmoji(voteEmoji); } catch (_e) {}

    const linkRow = new ActionRowBuilder().addComponents(support, invite, vote);

    const query = args.join(" ").trim().toLowerCase();

    if (!query) {
      const commandsDir = path.join(__dirname, "../../commands");
      const categories = [];

      for (const dir of readdirSync(commandsDir)) {
        if (dir === "owner") continue;

        const dirPath = path.join(commandsDir, dir);
        let isDirectory = false;
        try {
          isDirectory = statSync(dirPath).isDirectory();
        } catch (_e) {
          isDirectory = false;
        }
        if (!isDirectory) continue;

        if (dir === "fun") {
          const funActionsDir = path.join(dirPath, "actions");
          const funGamesDir = path.join(dirPath, "games");

          const getNames = folderPath => {
            let names = [];
            try {
              names = getAllCommandFiles(folderPath)
                .map(filePath => {
                  try {
                    const cmd = require(filePath);
                    return cmd?.name ? `\`${cmd.name.toLowerCase()}\`` : null;
                  } catch (_err) {
                    return null;
                  }
                })
                .filter(Boolean);
            } catch (_e) {
              names = [];
            }
            return names;
          };

          const actionNames = getNames(funActionsDir);
          const gameNames = getNames(funGamesDir);
          const total = actionNames.length + gameNames.length;
          if (!total) continue;

          const lines = [];
          if (gameNames.length) lines.push(`**Games (${gameNames.length})**: ${gameNames.join(", ")}`);
          if (actionNames.length) lines.push(`**Actions (${actionNames.length})**: ${actionNames.join(", ")}`);

          let value = lines.join("\n");
          if (value.length > 1020) value = `${value.slice(0, 1017)}...`;

          categories.push({
            name: `${getEmoji("star")} Fun (${total})`,
            value,
            inline: false
          });
          continue;
        }

        const names = getAllCommandFiles(dirPath)
          .map(filePath => {
            try {
              const cmd = require(filePath);
              return cmd?.name ? `\`${cmd.name.toLowerCase()}\`` : null;
            } catch (_err) {
              return null;
            }
          })
          .filter(Boolean);

        if (!names.length) continue;

        const value = names.join(", ");
        categories.push({
          name: `${getEmoji("star")} ${dir.charAt(0).toUpperCase()}${dir.slice(1)} (${names.length})`,
          value: value.length > 1020 ? `${value.slice(0, 1017)}...` : value,
          inline: false
        });
      }

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription([
          `Use \`${prefix}help <command>\` for detailed usage.`,
          `You can also use slash commands with \`/help\`.`
        ].join("\n"))
        .setAuthor({ name: "Joker Music Help Menu", iconURL: client.user.displayAvatarURL({ forceStatic: false }) }); 
        
        
if (categories.length > 0) embed.addFields(categories);
      return message.channel.send({ embeds: [embed], components: [linkRow] });
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
