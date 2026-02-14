const { EmbedBuilder, CommandInteraction, Client, ButtonBuilder } = require("discord.js");
const { intpaginationEmbed } = require('../../utils/pagination.js');
const safeReply = require('../../utils/safeReply');
const musicChecks = require('../../utils/musicChecks');
let chunk = require('chunk');

module.exports = {
  name: "queue",
  description: "Show the music queue and now playing.",
  owner: false,
  player: true,
  inVoiceChannel: true,
  wl : true,
  sameVoiceChannel: false,

  /**
   * 
   * @param {Client} client 
   * @param {CommandInteraction} interaction 
   */

  run: async (client, interaction) => {
    return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
      await safeReply.safeDeferReply(interaction);

      let ok = client.emoji.ok;
      let no = client.emoji.no;

      // Check cooldown
      const cooldown = client.cooldownManager.check("queue", interaction.user.id);
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
        sameChannel: false,
        requirePlayer: true,
        requireQueue: true
      });

      if (!check.valid) {
        return await safeReply.safeReply(interaction, { embeds: [check.embed] });
      }

      // Get queue using thread-safe controller
      const queue = await client.playerController.getQueue(interaction.guildId);
      const currentTrack = await client.playerController.getCurrentTrack(interaction.guildId);

      if (!queue || queue.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} There is nothing playing in this server or there are no songs in the queue.`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      // Format queue entries
      const queueEntries = queue.map((track, i) => {
        const title = track?.info?.title || track?.title || 'Unknown Title';
        const duration = track?.info?.duration || track?.duration;
        const isStream = track?.info?.isStream || track?.isStream;
        const durationStr = isStream ? '◉ LIVE' : (duration ? new Date(duration).toISOString().slice(11, 19) : 'Unknown');
        return `${i + 1}. ${title} - \`${durationStr}\``;
      });

      // Chunk queue into pages (10 per page)
      const chunked = chunk(queueEntries, 10);
      const embeds = [];

      const currentTitle = currentTrack?.info?.title || currentTrack?.title || 'No current track';
      const currentDuration = !currentTrack?.isStream ? (currentTrack?.duration ? new Date(currentTrack.duration).toISOString().slice(11, 19) : 'Unknown') : '◉ LIVE';

      for (let i = 1; i <= chunked.length; ++i) {
        const upcoming = chunked[i - 1] && chunked[i - 1].length ? chunked[i - 1].join('\n') : '*No more tracks in line.*';
        embeds.push(new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setTitle(`${interaction.guild.name} Music Queue`)
          .setDescription(`**Now playing**\n${currentTitle} - \`${currentDuration}\`\n\n**Upcoming tracks**\n${upcoming}`)
          .setFooter({ text: `Page ${i}/${chunked.length}` }));
      }

      const button1 = new ButtonBuilder().setCustomId('first').setLabel('First').setStyle(2);
      const button2 = new ButtonBuilder().setCustomId('back').setLabel('Back').setStyle(2);
      const button3 = new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(2);
      const button4 = new ButtonBuilder().setCustomId('last').setLabel('Last').setStyle(2);
      const buttonList = [button1, button2, button3, button4];

      intpaginationEmbed(interaction, embeds, buttonList, interaction.member.user, 30000);

      // Set cooldown after success
      client.cooldownManager.set("queue", interaction.user.id, 1000);

      // Log the command
      client.logger.logCommand('queue', interaction.user.id, interaction.guildId, Date.now() - interaction.createdTimestamp, true);
    });
  }
};



