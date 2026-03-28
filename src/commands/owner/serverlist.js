const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");

function chunkArray(list, size) {
  if (!Array.isArray(list) || size <= 0) return [];
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

function buildPageEmbed({ embedColor, getEmoji, message, pages, pageIndex }) {
  return new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`${getEmoji("server")} Server List`)
    .setDescription(pages[pageIndex] || "No servers found.")
    .setFooter({ text: `${getEmoji("info")} Page ${pageIndex + 1}/${pages.length}` })
    .setAuthor({
      name: `${message.client.user.username} Guild Index`,
      iconURL: message.client.user.displayAvatarURL({ forceStatic: false })
    });
}

async function getAllGuildEntries(client) {
  const normalizeGuild = (guild) => ({
    name: String(guild?.name || "Unknown"),
    id: String(guild?.id || "Unknown"),
    memberCount: Number(guild?.memberCount || 0),
  });
  const mergeGuildLists = (lists) => {
    const merged = new Map();
    for (const list of Array.isArray(lists) ? lists : []) {
      for (const guild of Array.isArray(list) ? list : []) {
        if (!guild?.id) continue;
        merged.set(String(guild.id), normalizeGuild(guild));
      }
    }
    return [...merged.values()];
  };

  if (client?.cluster && typeof client.cluster.broadcastEval === "function") {
    try {
      const clusterGuildLists = await client.cluster.broadcastEval((c) =>
        c.guilds.cache.map((guild) => ({
          name: String(guild?.name || "Unknown"),
          id: String(guild?.id || "Unknown"),
          memberCount: Number(guild?.memberCount || 0),
        }))
      );
      return mergeGuildLists(clusterGuildLists);
    } catch (_err) {}
  }

  if (client?.shard && typeof client.shard.broadcastEval === "function") {
    try {
      const shardGuildLists = await client.shard.broadcastEval((c) =>
        c.guilds.cache.map((guild) => ({
          name: String(guild?.name || "Unknown"),
          id: String(guild?.id || "Unknown"),
          memberCount: Number(guild?.memberCount || 0),
        }))
      );
      return mergeGuildLists(shardGuildLists);
    } catch (_err) {}
  }

  return client.guilds.cache.map((guild) => normalizeGuild(guild));
}

module.exports = {
  name: "topsecret",
  category: "owner",
  description: "Shows server list (Owner only).",
  aliases: ["sl"],
  owneronly: true,
  execute: async (message, args, client) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";

    const createPaginationButtons = (page = 1, total = 1) => {
      const first = new ButtonBuilder().setCustomId("first").setLabel("First").setStyle(ButtonStyle.Secondary).setDisabled(page <= 1);
      const back = new ButtonBuilder().setCustomId("back").setLabel("Back").setStyle(ButtonStyle.Secondary).setDisabled(page <= 1);
      const next = new ButtonBuilder().setCustomId("next").setLabel("Next").setStyle(ButtonStyle.Primary).setDisabled(page >= total);
      const last = new ButtonBuilder().setCustomId("last").setLabel("Last").setStyle(ButtonStyle.Primary).setDisabled(page >= total);
      try { first.setEmoji(getEmoji("first")); } catch (_e) {}
      try { back.setEmoji(getEmoji("back")); } catch (_e) {}
      try { next.setEmoji(getEmoji("next")); } catch (_e) {}
      try { last.setEmoji(getEmoji("last")); } catch (_e) {}
      return [first, back, next, last];
    };

    const guildEntries = await getAllGuildEntries(client);
    const servers = guildEntries
      .sort((left, right) => Number(right?.memberCount || 0) - Number(left?.memberCount || 0))
      .map((guild, index) => `${index + 1}. \`${guild.name}\` | \`${guild.id}\` | members: \`${Number(guild.memberCount || 0).toLocaleString("en-US")}\``);

    const chunks = chunkArray(servers, 10);
    const pages = (chunks.length ? chunks : [["No servers found."]]).map((lines) => lines.join("\n"));
    let page = 0;

    const navButtons = createPaginationButtons(1, pages.length)
      .map((button) => button.setCustomId(`serverlist_${button.data.custom_id}`));

    const closeButton = new ButtonBuilder()
      .setCustomId("serverlist_close")
      .setStyle(ButtonStyle.Danger)
      .setLabel("Close");
    try { closeButton.setEmoji(getEmoji("stop")); } catch (_err) {}

    const row = new ActionRowBuilder().addComponents([...navButtons, closeButton]);
    const msg = await message.channel.send({
      embeds: [buildPageEmbed({ embedColor, getEmoji, message, pages, pageIndex: page })],
      components: [row]
    });

    const collector = msg.createMessageComponentCollector({
      time: 5 * 60 * 1000,
      idle: 30 * 1000
    });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        await interaction.reply({
          content: `Only **${message.author.tag}** can use these buttons.`,
          ephemeral: true
        }).catch(() => {});
        return;
      }

      if (interaction.customId === "serverlist_close") {
        await interaction.deferUpdate().catch(() => {});
        collector.stop("closed");
        return;
      }

      switch (interaction.customId) {
        case "serverlist_first":
          page = 0;
          break;
        case "serverlist_back":
          page = page > 0 ? page - 1 : pages.length - 1;
          break;
        case "serverlist_next":
          page = page + 1 < pages.length ? page + 1 : 0;
          break;
        case "serverlist_last":
          page = pages.length - 1;
          break;
        default:
          return;
      }

      navButtons[0].setDisabled(page === 0);
      navButtons[1].setDisabled(page === 0);
      navButtons[2].setDisabled(page === pages.length - 1);
      navButtons[3].setDisabled(page === pages.length - 1);

      await interaction.update({
        embeds: [buildPageEmbed({ embedColor, getEmoji, message, pages, pageIndex: page })],
        components: [new ActionRowBuilder().addComponents([...navButtons, closeButton])]
      }).catch(() => {});
      collector.resetTimer();
    });

    collector.on("end", async () => {
      for (const button of navButtons) button.setDisabled(true);
      closeButton.setDisabled(true);
      await msg.edit({
        components: [new ActionRowBuilder().addComponents([...navButtons, closeButton])]
      }).catch(() => {});
    });
  }
};
