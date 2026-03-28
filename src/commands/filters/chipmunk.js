const { EmbedBuilder } = require('discord.js');

const EMOJIS = require("../../utils/emoji.json");

module.exports = {
  name: 'chipmunk',
  category: 'filters',
  description: 'Enables or disables the chipmunk filter.',
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

    const filterCore = client.core.filters;
    const enabled = await client.core.filterSettings.getFilter(message.guild.id, 'chipmunk');

    if (!enabled) {
      const applied = filterCore.sendRawFilters(player, message.guild.id, {
        timescale: {
          speed: 1.05,
          pitch: 1.35,
          rate: 1.25,
        },
      });

      if (!applied) {
        return await message.channel.send({ embeds: [new EmbedBuilder().setColor(color).setDescription(`${no} This Lavalink player does not support raw audio filters right now.`)] });
      }

      await client.core.filterSettings.setFilter(message.guild.id, 'chipmunk', true);
      player.set('filter', 'Chipmunk');

      return await message.channel.send({
        embeds: [new EmbedBuilder().setColor(color).setDescription(`${ok} Chipmunk has been \`enabled\`. - <@${message.member.id}>`)]
      }).catch(() => {});
    }

    await client.core.filterSettings.setFilter(message.guild.id, 'chipmunk', false);
    await filterCore.resetPlayerFilters(player, message.guild.id);
    player.set('eq', 'None');
    player.set('filter', 'None');

    return await message.channel.send({
      embeds: [new EmbedBuilder().setColor(color).setDescription(`${ok} Chipmunk has been \`disabled\`. - <@${message.member.id}>`)]
    }).catch(() => {});
  }
};
