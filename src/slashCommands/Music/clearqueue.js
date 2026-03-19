const { EmbedBuilder, CommandInteraction, Client } = require("discord.js");
const safeReply = require('../../utils/interactionResponder');
const musicChecks = require('../../utils/musicChecks');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
    name: "clearqueue",
    description: "Clear Queue",
    owner: false,
    player: true,
    djonly :true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    wl : true,

    /**
     *
     * @param {Client} client
     * @param {CommandInteraction} interaction
     */

    run: async (client, interaction) => {
      return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
        await safeReply.safeDeferReply(interaction);

        let ok = EMOJIS.ok;
        let no = EMOJIS.no;

        // Check cooldown
        const cooldown = client.cooldownManager.check("clearqueue", interaction.user.id);
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

        try {
          const player = check.player;
          if (typeof player.queue?.clear === 'function') {
            await player.queue.clear();
          } else if (Array.isArray(player.queue?.tracks) && player.queue.tracks.length > 0 && typeof player.queue.splice === 'function') {
            await player.queue.splice(0, player.queue.tracks.length);
          }
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} ${err?.message || 'Failed to clear queue'}`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${ok} The queue has been cleared.`);

        await safeReply.safeReply(interaction, { embeds: [embed] });

        // Set cooldown after success
        client.cooldownManager.set("clearqueue", interaction.user.id, 1000);

        // Log the command
        client.logger.logCommand('clearqueue', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
      });
    }
};
