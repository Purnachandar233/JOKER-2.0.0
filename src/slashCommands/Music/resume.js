const { EmbedBuilder, CommandInteraction, Client } = require("discord.js");
const safeReply = require('../../utils/interactionResponder');
const musicChecks = require('../../utils/musicChecks');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
    name: "resume",
    description: "Resume currently playing music",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    wl : true,
    djonly :true,

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
        const cooldown = client.cooldownManager.check("resume", interaction.user.id);
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

        if (!player.paused) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} The player is already resumed.`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        try {
          await player.resume();
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} ${err?.message || 'Failed to resume player'}`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${ok} **The player has been resumed.**`);

        await safeReply.safeReply(interaction, { embeds: [embed] });

        // Set cooldown after success
        client.cooldownManager.set("resume", interaction.user.id, 1000);

        // Log the command
        client.logger.logCommand('resume', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
      });
    }
};
