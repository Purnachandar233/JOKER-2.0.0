const { EmbedBuilder } = require('discord.js')

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: 'chipmunk',
  category: 'filters',
  description: 'Enables or disables the chipmunk filter.',
  args: false,
  usage: '',
  votelock: true,
  djonly: false,
  wl: true,
  execute: async (message, args, client, prefix) => {
    const ok = EMOJIS.ok
    const no = EMOJIS.no

    //
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
        const { getQueueArray } = client.core.queue;
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
      return await message.channel.send({ embeds: [noperms] })
    }
    //
    const filted = await client.core.filterSettings.getFilter(message.guild.id, 'chipmunk')
    if (!filted) {
      await client.core.filterSettings.setFilter(message.guild.id, 'chipmunk', true)
      player.node.send({
        op: 'filters',
        guildId: message.guild.id,
        equalizer: player.bands.map((gain, index) => {
          const Obj = {
            band: 0,
            gain: 0
          }
          Obj.band = Number(index)
          Obj.gain = Number(gain)
          return Obj
        }),
        timescale: {
          speed: 1.05,
          pitch: 1.35,
          rate: 1.25
        }
      })
      player.set('filter', '🐿️ Chipmunk')
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${ok} Chipmunk has been \`enabled\`.- <@${message.member.id}>`)

      message.channel.send({ embeds: [noperms] }).then(responce => {
        setTimeout(() => {
          try {
            responce.delete().catch(() => {

            })
          } catch (err) {

          }
        }, 30000)
      })
    } else {
      await client.core.filterSettings.setFilter(message.guild.id, 'chipmunk', false)
      player.clearEQ()
      player.node.send({
        op: 'filters',
        guildId: message.guild.id,
        equalizer: player.bands.map((gain, index) => {
          const Obj = {
            band: 0,
            gain: 0
          }
          Obj.band = Number(index)
          Obj.gain = Number(gain)
          return Obj
        })
      })
      player.set('eq', '💣 None')
      player.set('filter', '💣 None')
      const noperms = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${ok} Chipmunk has been \`disabled\`.- <@${message.member.id}>`)

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
}




