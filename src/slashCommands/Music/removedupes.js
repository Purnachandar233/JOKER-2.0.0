const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');
const safePlayer = require('../../utils/safePlayer');

module.exports = {
    name: "removedupes",
    description: "removes all duplicated tracks in the queue.",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    votelock: true,
    djonly: true,
    wl: true,

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
        const cooldown = client.cooldownManager.check("removedupes", interaction.user.id);
        if (cooldown.onCooldown) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Cooldown active. Try again in ${cooldown.remaining()}ms`);
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

        try {
          // Build unique tracks preserving order
          const unique = [];
          const seen = new Set();
          for (const t of tracks) {
            const id = t?.info?.identifier || t?.identifier || t?.uri || t?.id || null;
            if (!id) continue;
            if (!seen.has(id)) {
              seen.add(id);
              unique.push(t);
            }
          }

          // Clear the queue and re-add unique tracks
          await safePlayer.queueClear(player);
          safePlayer.queueAdd(player, unique);

          const embed = new EmbedBuilder()
            .setDescription(`${ok} Removed all duplicate songs from the queue.`)
            .setColor(interaction.client?.embedColor || '#ff0051');

          await safeReply.safeReply(interaction, { embeds: [embed] });

          // Set cooldown after success
          client.cooldownManager.set("removedupes", interaction.user.id, 1000);

          // Log the command
          client.logger.logCommand('removedupes', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Failed to remove duplicates: ${err && (err.message || err)}`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }
      });
    }
};




