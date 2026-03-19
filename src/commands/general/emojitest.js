const { EmbedBuilder } = require("discord.js");

const EMOJIS = require("../../utils/emoji.json");

function chunk(array, size) {
  const result = [];
  for (let index = 0; index < array.length; index += size) {
    result.push(array.slice(index, index + size));
  }
  return result;
}

module.exports = {
  name: "emojitest",
  category: "general",
  aliases: ["emojiinfo", "allemojis", "emojiembed"],
  description: "Shows all configured emojis inside embeds for render testing.",
  execute: async (message, _args, client) => {
    const entries = Object.entries(EMOJIS);
    if (!entries.length) {
      const emptyEmbed = new EmbedBuilder()
        .setColor(client?.embedColor || "#ff0051")
        .setTitle("Emoji Test")
        .setDescription("No emojis were found in `emoji.json`.");

      return message.channel.send({ embeds: [emptyEmbed] }).catch(() => {});
    }

    const pages = chunk(entries, 20);
    const embeds = pages.map((page, index) => {
      const lines = page.map(([key, value]) => `**${key}**\n${value}\n\`${value}\``);

      return new EmbedBuilder()
        .setColor(client?.embedColor || "#ff0051")
        .setTitle(`Emoji Test ${index + 1}/${pages.length}`)
        .setDescription(lines.join("\n\n").slice(0, 4096))
        .setFooter({ text: "Check which emojis render correctly on your device." });
    });

    return message.channel.send({ embeds }).catch(() => {});
  },
};
