const { EmbedBuilder } = require('discord.js');

const EMOJIS = require("../../utils/emoji.json");

const FILTER_FLAGS = [
  'eightD',
  'bassboost',
  'nightcore',
  'soft',
  'pop',
  'treblebass',
  'vaporwave',
  'karaoke',
  'vibrato',
  'tremolo',
  'chipmunk',
  'slowmo',
];

module.exports = {
  name: 'reset',
  aliases: ['clearfilters'],
  category: 'filters',
  description: 'Clears all the filters.',
  args: false,
  usage: '',
  votelock: true,
  djonly: true,
  wl: true,
  execute: async (message, args, client) => {
    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const color = message.client?.embedColor || '#ff0051';

    const { channel } = message.member.voice;
    if (!channel) {
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(color).setDescription(`${no} You must be connected to a voice channel to use this command.`)] });
    }

    if (message.member.voice.selfDeaf) {
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(color).setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`)] });
    }

    const player = client.lavalink.players.get(message.guild.id);
    const tracks = client.core.queue.getQueueArray(player);
    if (!player || !tracks.length) {
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(color).setDescription(`${no} There is nothing playing in this server.`)] });
    }

    if (channel.id !== player.voiceChannelId) {
      return await message.channel.send({ embeds: [new EmbedBuilder().setColor(color).setDescription(`${no} You must be connected to the same voice channel as me.`)] });
    }

    for (const key of FILTER_FLAGS) {
      player[key] = false;
    }

    await client.core.filterSettings.setFilter(message.guild.id, 'chipmunk', false);
    await client.core.filterSettings.setFilter(message.guild.id, 'slowmo', false);
    await client.core.filters.resetPlayerFilters(player, message.guild.id);
    player.set('eq', 'None');
    player.set('filter', 'None');

    return await message.channel.send({
      embeds: [new EmbedBuilder().setColor(color).setDescription(`${ok} All filters have been reset. - <@${message.member.id}>`)]
    }).catch(() => {});
  }
};
