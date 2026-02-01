const { EmbedBuilder, ButtonBuilder } = require("discord.js")
const { intpaginationEmbed } = require('../../utils/pagination.js');
let chunk = require('chunk');

module.exports = {
  name: 'queue',
  category: 'music',
  aliases: ["q", "list"],
  description: 'displays the music queue',
  owner: false,
  wl: true,
  execute: async (message, args, client, prefix) => {
    const { channel } = message.member.voice;
    if (!channel) {
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("*Join a voice channel to view the queue list.*")] });
    }

    if (!client.lavalink) {
        return await message.channel.send({embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("* Lavalink is not connected yet. Please try again in a moment.*")]});
    }

    const player = client.lavalink.players.get(message.guild.id);
    const { getQueueArray } = require('../../utils/queue.js');
    const tracks = getQueueArray(player);
    if (!player || !tracks || tracks.length === 0) {
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("* Nothing is currently playing.*")] });
    }

    if (player && channel.id !== player.voiceChannelId) {
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription("*We must be in the same voice channel.*")] });
    }
    
    const queue = tracks.map((track, i) => {
        const title = track.info?.title?.substring(0, 30) || track.title?.substring(0, 30) || 'Unknown Title';
        const duration = track.info?.duration || track.duration;
        const isStream = track.info?.isStream || track.isStream;
        const durationStr = isStream ? 'LIVE' : (duration ? new Date(duration).toISOString().slice(14, 19) : 'Unknown');
        return `**${i+1}.** ${title}... \`[${durationStr}]\``;
    });
    const chunked = chunk(queue, 10);
    const embeds = [];

    for (let i = 0; i < chunked.length; i++) {
        const nowTitle = tracks[0]?.info?.title || tracks[0]?.title || 'No current track';
        embeds.push(new EmbedBuilder()
          .setColor(message.client?.embedColor || '#ff0051')
          .setTitle(`Current Queue`)
          .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
          .setDescription(`**Now Playing**\n┕ ${nowTitle}\n\n**Upcoming Tracks**\n${chunked[i].join('\n') || "*No more tracks in line.*"}`)
          .setFooter({ text: `Classic Page ${i + 1}/${chunked.length} • Joker Music` }));
    }

    if (embeds.length === 0) {
        const nowTitle = tracks[0]?.info?.title || tracks[0]?.title || 'No current track';
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor(message.client?.embedColor || '#ff0051')
          .setTitle(`Current Queue`)
          .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
          .setDescription(`**Now Playing**\n┕ ${nowTitle}\n\n**Upcoming Tracks**\n*No more tracks in line.*`)
          .setFooter({ text: `Classic Page 1/1 • Joker Music` })] });
    }

    if (embeds.length === 1) {
        return message.channel.send({ embeds: [embeds[0]] });
    }

    const buttonList = [
        new ButtonBuilder().setCustomId('first').setLabel('First').setStyle(2),
        new ButtonBuilder().setCustomId('back').setLabel('Back').setStyle(2),
        new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(2),
        new ButtonBuilder().setCustomId('last').setLabel('Last').setStyle(2)
    ];

    intpaginationEmbed(message, embeds, buttonList, message.member.user, 30000);
  }
}
