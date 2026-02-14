const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const { arrayMove } = require(`../../functions.js`);
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');
const safePlayer = require('../../utils/safePlayer');

module.exports = {
    name: "move",
    description: "Change the position of a track in the queue.",
    owner: false,
    player: true,
    inVoiceChannel: true,
    djonly: true,
    sameVoiceChannel: true,
    wl: true,
    options: [
      {
        name: "from",
        description: "the position",
        required: true,
        type: 4
      },
      {
        name: "to",
        description: "the new position",
        required: true,
        type: 4
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
        const cooldown = client.cooldownManager.check("move", interaction.user.id);
        if (cooldown.onCooldown) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Cooldown active. Try again in ${cooldown.remaining()}ms`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        const from = interaction.options.getNumber("from");
        const to = interaction.options.getNumber("to");

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
        const qSize = safePlayer.queueSize(player);

        // Validate positions
        if (from <= 1 || from > qSize) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} From position must be a number greater than \`1\` and smaller than \`${qSize}\``);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        if (to <= 1 || to > qSize) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} To position must be a number greater than \`1\` and smaller than \`${qSize}\``);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        try {
          // Convert 1-based positions to 0-based indices
          const fromIndex = Math.max(0, Math.min(tracks.length - 1, from - 1));
          const toIndex = Math.max(0, Math.min(tracks.length - 1, to - 1));
          
          // Move track in queue
          const newQueue = arrayMove(tracks, fromIndex, toIndex);
          
          // Clear and re-add with new order
          await safePlayer.queueClear(player);
          safePlayer.queueAdd(player, newQueue);

          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${ok} Moved track from position \`${from}\` to position \`${to}\``);

          await safeReply.safeReply(interaction, { embeds: [embed] });

          // Set cooldown after success
          client.cooldownManager.set("move", interaction.user.id, 1000);

          // Log the command
          client.logger.logCommand('move', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Failed to move track: ${err && (err.message || err)}`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }
      });
    }
};




