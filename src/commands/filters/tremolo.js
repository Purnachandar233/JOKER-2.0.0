const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js')

module.exports = {
  name: 'tremolo',
  category: 'filters',
  description: 'Enables or disables the tremolo filter.',
  args: false,
  usage: '',
  votelock: true,
  djonly: true,
  wl: true,
  execute: async (message, args, client, prefix) => {
    const ok = client.emoji.ok
    const no = client.emoji.no

    //
    const { channel } = message.member.voice
    if (!channel) {
      const noperms = new EmbedBuilder()

        .setColor(0xff0051)
        .setDescription(`${no} You must be connected to a voice channel to use this command.`)
      return await message.channel.send({ embeds: [noperms] })
    }
    if (message.member.voice.selfDeaf) {
      const thing = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`)
      return await message.channel.send({ embeds: [thing] })
    }
        const player = client.lavalink.players.get(message.guild.id)
    if(!player || !player.queue.current) {
      const noperms = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} There is nothing playing in this server.`)
      return await message.channel.send({ embeds: [noperms] })
    }
    if (player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} You must be connected to the same voice channel as me.`)
      return await message.channel.send({ embeds: [noperms] })
    }
    //
    if (player.tremolo !== true) {
      player.tremolo = true
      const noperms = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${ok} Tremolo has been \`enabled\`.- <@${message.member.id}>`)

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
      if (player.tremolo === true) {
        player.tremolo = false
        const noperms = new EmbedBuilder()
          .setColor(0xff0051)
          .setDescription(`${ok} Tremolo has been \`disabled\`.- <@${message.member.id}>`)

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
}


