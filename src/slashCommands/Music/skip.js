const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const safeReply = require('../../utils/interactionResponder');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
        name: "skip",
        description: "To skip a song/track from the queue.",
        owner: false,
        djonly: true,
        player: true,
        inVoiceChannel: true,
        sameVoiceChannel: true,
        wl : true,

    /**
     *
     * @param {Client} client
     * @param {CommandInteraction} interaction
     * @param {String} color
     */

  run: async (client, interaction) => {
    return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
      await safeReply.safeDeferReply(interaction);

      let ok = EMOJIS.ok;
      let no = EMOJIS.no;

      // Check cooldown
      const cooldown = client.cooldownManager.check("skip", interaction.user.id);
      if (cooldown.onCooldown) {
        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} Cooldown active. Try again in ${cooldown.remaining()}ms`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      // Run music checks
      const check = await client.runMusicChecks(interaction, {
        inVoiceChannel: true,
        botInVoiceChannel: true,
        sameChannel: true,
        requirePlayer: true,
        requireQueue: true
      });

      if (!check.valid) {
        return await safeReply.safeReply(interaction, { embeds: [check.embed] });
      }

      try {
        await check.player.skip();
      } catch (err) {
        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} ${err?.message || 'Failed to skip track'}`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription(`${ok} Skipping to the next track.`);

      await safeReply.safeReply(interaction, { embeds: [embed] });

      // Set cooldown after success
      client.cooldownManager.set("skip", interaction.user.id, 1000);

      // Log the command
      client.logger.logCommand('skip', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
    });
  }
};

