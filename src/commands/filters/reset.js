const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js')

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: 'reset',
  aliases: ['clearfilters'],
  category: 'filters',
  description: 'Clears all the filters.',
  args: false,
  usage: '',
  votelock: true,
  djonly: false,
  wl: true,
  execute: async (message, args, client, prefix) => {
    const ok = EMOJIS.ok
    const no = EMOJIS.no

    //
    const { channel } = message.member.voice
    if (!channel) {
      const noperms = new EmbedBuilder()

        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${no} You must be connected to a voice channel to use this command.`)
      return await message.channel.send({ embeds: [noperms] })
    }
    if (message.member.voice.selfDeaf) {
      const thing = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`)
      return await message.channel.send({ embeds: [thing] })
    }
        const player = client.lavalink.players.get(message.guild.id)
      const { getQueueArray } = require('../../../src/utils/queue.js');
      const tracks = getQueueArray(player);
      if(!player || !tracks || tracks.length === 0) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${no} There is nothing playing in this server.`)
      return await message.channel.send({ embeds: [noperms] })
    }
    if (player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${no} You must be connected to the same voice channel as me.`)
      return await message.channel.send({ embeds: [noperms] }),
      message.channel.send({ embeds: [noperms] })
    }
    //
    player.reset()
    const noperms = new EmbedBuilder()
      .setColor(message.client?.embedColor || '#ff0051')
      .setDescription(`${ok} All filters has been reseted.- <@${message.member.id}>`)

    message.channel.send({ embeds: [noperms] }).then(responce => {
      setTimeout(() => {
        try {
          responce.delete().catch(() => {

          })
        } catch (err) {

        }
      }, 30000)
    })
  }
}

