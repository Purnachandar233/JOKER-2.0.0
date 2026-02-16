const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const { readdirSync, statSync } = require("fs");
const path = require("path");
const configPrefix = require("../../../config.json").prefix;

const EMOJIS = require("../../utils/emoji.json");
function getAllCommandFiles(dir) {
  const files = [];
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) files.push(...getAllCommandFiles(fullPath));
    else if (item.endsWith(".js")) files.push(fullPath);
  }
  return files;
}

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

    await interaction.deferReply({ ephemeral: false }).catch(() => {});

    const query = (interaction.options.getString("command") || "").trim().toLowerCase();

    if (!query) {
      const categories = [];

      for (const dir of readdirSync("./src/commands/")) {
        if (dir === "owner") continue;

        const dirPath = path.join("./src/commands/", dir);
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
                    const cmd = require(path.resolve(filePath));
                    return cmd?.name ? `\`${cmd.name}\`` : null;
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
              const cmd = require(path.resolve(filePath));
              return cmd?.name ? `\`${cmd.name}\`` : null;
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

      const embed = createEmbed({
        description: [
          `Use \`${configPrefix}help <command>\` for prefix command details.`,
          "Use this slash command with `/help command:<name>` for slash details."
        ].join("\n"),
        author: {
          name: `Joker Help Menu`,
          iconURL: client.user.displayAvatarURL({ forceStatic: false })
        },
        fields: categories,
        footer: `${getEmoji("support")} Command Navigator`
      });

      return interaction.editReply({ embeds: [embed], components: [createLinkRow()] });
    }

    const command = client.sls.get(query);
    if (!command) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Command Not Found`,
        description: `No slash command matched \`${query}\`.`
      });
      return interaction.editReply({ embeds: [embed] });
    }

    const detail = createEmbed({
      title: `${getEmoji("info")} /${command.name}`,
      description: command.description || "No description provided.",
      fields: [
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
      ],
      footer: `${getEmoji("music")} Slash Command Detail`
    });

    return interaction.editReply({ embeds: [detail] });
  }
};

