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
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2f3136).setDescription("*Join a voice channel to view the symphony's queue.*")] });
    }

    if (!client.lavalink) {
        return await message.channel.send({embeds: [new EmbedBuilder().setColor(0xff0051).setDescription("* Lavalink is not connected yet. Please try again in a moment.*")]});
    }

    const player = client.lavalink.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2f3136).setDescription("*The silence is heavy. Nothing is currently playing.*")] });
    }

    if (player && channel.id !== player.voiceChannelId) {
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2f3136).setDescription("*We must be in the same voice channel to harmonize.*")] });
    }

    const queue = player.queue.map((track, i) => `**${++i}.** ${track.info?.title?.substring(0, 30) || track.title?.substring(0, 30)}... \`[${!(track.info?.isStream || track.isStream) ? new Date(track.info?.duration || track.duration).toISOString().slice(14, 19) : 'LIVE'}]\``);
    const chunked = chunk(queue, 10);
    const embeds = [];

    for (let i = 0; i < chunked.length; i++) {
        embeds.push(new EmbedBuilder()
          .setColor(0x2f3136)
          .setTitle(`Current Symphony Queue`)
          .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
          .setDescription(`**Now Playing**\n┕ ${player.queue.current.info?.title || player.queue.current.title}\n\n**Upcoming Tracks**\n${chunked[i].join('\n') || "*No more tracks in line.*"}`)
          .setFooter({ text: `Classic Page ${i + 1}/${chunked.length} • Joker Music` }));
    }

    if (embeds.length === 1) {
        return message.channel.send({ embeds: [embeds[0]] });
    }

    const buttonList = [
        new ButtonBuilder().setCustomId('back').setLabel('Back').setStyle(2),
        new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(2)
    ];

    intpaginationEmbed(message, embeds, buttonList, message.member.user, 30000);
  }
}
