const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');

module.exports = {
    name: "loop",
    description: "Toggle looping",
    type: 1,
    wl : true,
    options: [
        {
            name: "mode",
            description: "The loop mode",
            type: 3,
            required: true,
            choices: [
                {
                    name: "track",
                    value: "track"
                },
                {
                    name: "queue",
                    value: "queue"
                },
                {
                    name: "disabled",
                    value: "disabled"
                },
            ],
        },
    ],
    djonly: true,

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
        const cooldown = client.cooldownManager.check("loop", interaction.user.id);
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
        const mode = interaction.options.getString("mode");

        try {
          if (mode === 'track') {
            player.setRepeatMode(player.repeatMode === 'track' ? 'off' : 'track');
            const trackRepeat = player.repeatMode === 'track' ? "enabled" : "disabled";
            const embed = new EmbedBuilder()
              .setColor(interaction.client.embedColor)
              .setDescription(`${ok} Looping the track is now \`${trackRepeat}\``);
            await safeReply.safeReply(interaction, { embeds: [embed] });
          }
          else if (mode === 'queue') {
            player.setRepeatMode(player.repeatMode === 'queue' ? 'off' : 'queue');
            const queueRepeat = player.repeatMode === 'queue' ? "enabled" : "disabled";
            const embed = new EmbedBuilder()
              .setColor(interaction.client.embedColor)
              .setDescription(`${ok} Looping the queue is now \`${queueRepeat}\``);
            await safeReply.safeReply(interaction, { embeds: [embed] });
          }
          else if (mode === 'disabled') {
            player.setRepeatMode('off');
            const embed = new EmbedBuilder()
              .setColor(interaction.client.embedColor)
              .setDescription(`${ok} Disabled all looping options.`);
            await safeReply.safeReply(interaction, { embeds: [embed] });
          }

          // Set cooldown after success
          client.cooldownManager.set("loop", interaction.user.id, 1000);

          // Log the command
          client.logger.logCommand('loop', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Failed to set loop mode: ${err && (err.message || err)}`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }
      });
    }
};



