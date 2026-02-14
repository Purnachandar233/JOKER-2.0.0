const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');
const safePlayer = require('../../utils/safePlayer');

module.exports = {
    name: "remove",
    description: "Remove song from the queue",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    djonly: true,
    wl: true,
    options: [
      {
        name: "number",
        description: "Number of the song in queue",
        required: true,
        type: 10
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

        // Check cooldown
        const cooldown = client.cooldownManager.check("remove", interaction.user.id);
        if (cooldown.onCooldown) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Cooldown active. Try again in ${cooldown.remaining()}ms`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        const position = interaction.options.getNumber("number");

        // Validate position
        if (!Number.isFinite(position) || position < 1) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Invalid track number.`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        // Run music checks
        const check = await musicChecks.runMusicChecks(client, interaction, {
          inVoiceChannel: true,
          botInVoiceChannel: true,
          sameChannel: true,
          requirePlayer: true,
          requireQueue: true
        });

        if (!check.valid) {
          return await safeReply.safeReply(interaction, { embeds: [check.embed] });
        }

        const player = check.player;
        const tracks = safePlayer.getQueueArray(player);

        // Validate position within queue bounds
        if (position > tracks.length) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} No songs at number \`${position}\`. Total songs: \`${tracks.length}\``);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        try {
          const song = tracks[position - 1];
          safePlayer.queueRemove(player, position - 1);

          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${ok} **Removed song from the queue**`);

          await safeReply.safeReply(interaction, { embeds: [embed] });

          // Set cooldown after success
          client.cooldownManager.set("remove", interaction.user.id, 1000);

          // Log the command
          client.logger.logCommand('remove', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Failed to remove track: ${err && (err.message || err)}`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }
      });
    }
};



