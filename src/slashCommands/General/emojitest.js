const { ApplicationCommandType, EmbedBuilder } = require("discord.js");

const { safeReply, safeDeferReply } = require("../../utils/interactionResponder");
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
  description: "Shows all configured emojis inside embeds for render testing.",
  type: ApplicationCommandType.ChatInput,
  wl: true,
  run: async (client, interaction) => {
    const deferred = await safeDeferReply(interaction, { ephemeral: false });
    if (!deferred) {
      return safeReply(interaction, { content: "Failed to defer reply. Please try again." });
    }

    const entries = Object.entries(EMOJIS);
    if (!entries.length) {
      const emptyEmbed = new EmbedBuilder()
        .setColor(client?.embedColor || "#ff0051")
        .setTitle("Emoji Test")
        .setDescription("No emojis were found in `emoji.json`.");

      return safeReply(interaction, { embeds: [emptyEmbed] });
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

    return safeReply(interaction, { embeds });
  },
};
