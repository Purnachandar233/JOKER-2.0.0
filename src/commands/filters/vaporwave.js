const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js')

module.exports = {
  name: 'vaporwave',
  category: 'filters',
  description: 'Enables or disables the vaporwave filter.',
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
    if (player.vaporwave !== true) {
      player.vaporwave = true
      const noperms = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${ok} Vaporwave has been \`enabled\`.- <@${message.member.id}>`)
      const noperms1 = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription('Applying the `vaporwave` Filter. (*It might take up to 5 seconds until you hear the Filter*)')
      return await message.channel.send({ embeds: [noperms1] }),
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
    if (player.vaporwave === true) {
      player.vaporwave = false
      const noperms = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${ok} Vaporwave has been \`disabled\`.- <@${message.member.id}>`)
      const noperms1 = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription('Removing the `vaporwave` Filter. (*It might take up to 5 seconds to remove the filter.*)')

      return await message.channel.send({ embeds: [noperms1] }),
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


