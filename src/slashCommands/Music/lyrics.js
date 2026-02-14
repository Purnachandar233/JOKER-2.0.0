const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const lyricsFinder = require("lyrics-finder");
const safeReply = require('../../utils/safeReply');

module.exports = {
  name: "lyrics",
  description: "Shows the lyrics of the song searched.",
  owner: false,
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  wl: true,
  options: [
    {
      name: "name",
      description: "Song Name",
      required: true,
      type: 3
    }
  ],

  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */

  run: async (client, interaction) => {
    return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
      await safeReply.safeDeferReply(interaction);

      let ok = client.emoji.ok;
      let no = client.emoji.no;

      const song = interaction.options.getString("name");

      try {
        let res = await lyricsFinder(song);
        if (!res) {
          const embed = new EmbedBuilder()
            .setDescription(`${no} No results found.`)
            .setColor(interaction.client?.embedColor || '#ff0051');
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        // Send first page (2048 char limit)
        const lyrics = res.substring(0, Math.min(res.length, 2048));
        const embed = new EmbedBuilder()
          .setDescription(lyrics)
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setTitle(song);

        await safeReply.safeReply(interaction, { embeds: [embed] });

        // Log the command
        client.logger.logCommand('lyrics', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
      } catch (err) {
        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} Failed to fetch lyrics: ${err && (err.message || err)}`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }
    });
  }
};