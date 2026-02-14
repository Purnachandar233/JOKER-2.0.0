const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const { convertTime } = require('../../utils/convert.js');
const ms = require('ms');
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');
const safePlayer = require('../../utils/safePlayer');

module.exports = {
    name: "forward",
    description: "Forwards a song in seconds.",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    djonly: true,
    wl: true,
    options: [
      {
        name: "time",
        description: "the time example 1m.",
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

        // Check cooldown
        const cooldown = client.cooldownManager.check("forward", interaction.user.id);
        if (cooldown.onCooldown) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Cooldown active. Try again in ${cooldown.remaining()}ms`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }

        const time = interaction.options.getString("time");
        const timeMs = ms(time);

        // Validate time format
        if (!timeMs || isNaN(timeMs)) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Please specify a valid time ex: \`1h\`, \`30m\`, \`45s\`.`);
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
          let seekTime = Number(player.position) + Number(timeMs);
          const currentDuration = tracks[0]?.duration || tracks[0]?.info?.duration || 0;
          if (Number(seekTime) >= currentDuration) seekTime = currentDuration - 1000;

          await safePlayer.safeCall(player, 'seek', Number(seekTime));
          
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${ok} Forward by \`${convertTime(timeMs)}\``);
          
          await safeReply.safeReply(interaction, { embeds: [embed] });

          // Set cooldown after success
          client.cooldownManager.set("forward", interaction.user.id, 1000);

          // Log the command
          client.logger.logCommand('forward', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
        } catch (err) {
          const embed = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${no} Failed to forward: ${err && (err.message || err)}`);
          return await safeReply.safeReply(interaction, { embeds: [embed] });
        }
      });
    }
};


