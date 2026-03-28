const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const safeReply = require('../../utils/interactionResponder');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
    name: "volume",
    description: "Changes the volume of the currently playing track.",
    owner: false,
    djonly: true,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    wl : true,
    options: [
      {
        name: "volume",
        description: "the new volume (0-100).",
        required: true,
        type: 10
      }
    ],
    votelock: true,

    /**
     * @param {Client} client
     * @param {CommandInteraction} interaction
     */

    run: async (client, interaction) => {
      return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
        await safeReply.safeDeferReply(interaction);

        let ok = EMOJIS.ok;
        let no = EMOJIS.no;

        // Check cooldown
        const cooldown = client.cooldownManager.check("volume", interaction.user.id);
        if (cooldown.onCooldown) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Cooldown active. Try again in ${cooldown.remaining()}ms`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        const volume = interaction.options.getNumber("volume");

        // Validate volume range
        if (volume < 0 || volume > 100) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Please use a number between \`0\` - \`100\``);
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
          await check.player.setVolume(Math.max(0, Math.min(100, volume)));
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} ${err?.message || 'Failed to set volume'}`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${ok} The volume has been changed to **${volume}%**`);

        await safeReply.safeReply(interaction, { embeds: [embed] });

        // Set cooldown after success
        client.cooldownManager.set("volume", interaction.user.id, 1000);

        // Log the command
        client.logger.logCommand('volume', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
      });
    }
};

