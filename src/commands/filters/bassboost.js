const { EmbedBuilder } = require('discord.js')

module.exports = {
  name: 'bassboost',
  category: 'filters',
  description: 'Enables or disables the bassboost filter.',
  args: false,
  usage: '',
  djonly: true,
  votelock: true,
  wl: true,
  execute: async (message, args, client, prefix) => {
    const ok = client.emoji.ok
    const no = client.emoji.no

    const { channel } = message.member.voice
    if (!channel) {
      const noperms = new EmbedBuilder()
        .setColor(0x2f3136)
        .setDescription(`${no} You must be connected to a voice channel to use this command.`)
      return await message.channel.send({ embeds: [noperms] })
    }
    if (message.member.voice.selfDeaf) {
      const thing = new EmbedBuilder()
        .setColor(0x2f3136)
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`)
      return await message.channel.send({ embeds: [thing] })
    }
    const player = client.lavalink.players.get(message.guild.id)
    if (!player || !player.queue.current) {
      const noperms = new EmbedBuilder()
        .setColor(0x2f3136)
        .setDescription(`${no} There is nothing playing in this server.`)
      return await message.channel.send({ embeds: [noperms] })
    }
    if (player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder()
        .setColor(0x2f3136)
        .setDescription(`${no} You must be connected to the same voice channel as me.`)
      return await message.channel.send({ embeds: [noperms] })
    }

    if (!player.bassboost) {
      player.bassboost = true
      const embed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setDescription(`${ok} Bassboost has been \`enabled\`.`)
      message.channel.send({ embeds: [embed] })
    } else {
      player.bassboost = false
      const embed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setDescription(`${ok} Bassboost has been \`disabled\`.`)
      message.channel.send({ embeds: [embed] })
    }
  }
}

