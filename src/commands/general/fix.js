const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js')

module.exports = {
  name: 'fix',
  category: 'settings',
  description: 'Tries to fix the lag or other audio issues forcefully by changing server region.',
  owner: false,
  wl: true,
  execute: async (message, args, client, prefix) => {
    const ok = client.emoji.ok
    const no = client.emoji.no
    if (!message.member.permissions.has('MANAGE_CHANNELS')) {
      const noperms = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription('You need this required Permissions: `MANAGE_CHANNELS` to run this command.')
      await message.channel.send({ embeds: [noperms] })
    }
    const { channel } = message.member.voice
    if (!channel) {
      const noperms = new EmbedBuilder()

        .setColor(0xff0051)
        .setDescription(`${no} You must be connected to a voice channel to use this command.`)
      return await message.reply({ embeds: [noperms], empheral: true })
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

    if (args) {
      const guild = client.guilds.cache.get(message.guild.id)
      const voiceChannel = guild.channels.cache.get(player.voiceChannelId)
      const validregions = ['us-west', 'brazil', 'hongkong', 'india', 'japan', 'rotterdam', 'russia', 'singapore', 'south-korea', 'southafrica', 'sydney', 'us-central', 'us-east', 'us-south']
      if (!validregions.includes(args[0])) {
        const noperms = new EmbedBuilder()
          .setColor(0xff0051)
          .setDescription('**This Is An Invalid Region Please Select A Valid Region**. \\n\\n Available regions - `brazil`, `hongkong`, `india`, `japan`, `rotterdam`, `russia`, `singapore`, `south-korea`, `southafrica`, `sydney`, `us-central`, `us-east`, `us-south`, `us-west`')
        return message.channel.send({ embeds: [noperms] }).then(responce => {
          setTimeout(() => {
            try {
              responce.delete().catch(() => {

              })
            } catch (err) {

            }
          }, 12000)
        })
      }

      try {
        const channelOpts = {
          rtcRegion: args
        }

        voiceChannel.edit(channelOpts, 'Fix command')

        const noperms = new EmbedBuilder()
          .setColor(0xff0051)
          .setDescription(`Voice Region is now set to \`${args}\`.`)
        return await message.channel.send({ embeds: [noperms] })
      } catch (e) {
        return await message.channel.send({ content: 'Unable to change the voice region make sure I have the `MANAGE_CHANNELS` permission and make sure you specified a vaild voicechannel region.' })
      }
      return
    }

    const guild = client.guilds.cache.get(message.guild.id)
    const voiceChannel = guild.channels.cache.get(player.voiceChannelId)
    const Responses = ['us-west', 'brazil', 'hongkong', 'india', 'japan', 'rotterdam', 'russia', 'singapore', 'south-korea', 'southafrica', 'sydney', 'us-central', 'us-east', 'us-south']
    const rc = Math.floor(Math.random() * Responses.length)
    const validregions = ['us-west', 'brazil', 'hongkong', 'india', 'japan', 'rotterdam', 'russia', 'singapore', 'south-korea', 'southafrica', 'sydney', 'us-central', 'us-east', 'us-south']
    if (!validregions.includes(args[0])) {
      const noperms = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription('This Is An Invalid Region Please Select A Correct Region. \n Available regions - us-west, brazil, hongkong, india, japan, rotterdam\n russia, singapore, south-korea, southafrica, sydney, us-central, us-east, us-south ')
      return message.channel.send({ embeds: [noperms] })
    }

    try {
      const channelOpts = {
        rtcRegion: Responses[rc]
      }

      voiceChannel.edit(channelOpts, 'Fix command')

      const noperms = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`Voice Region is now set to \`${Responses[rc]}\`.`)
      return await message.channel.send({ embeds: [noperms] })
    } catch (e) {
      return await message.channel.send({ content: 'Unable to change the voice region make sure I have the `MANAGE_CHANNELS` permission and try again.' })
    }
  }
}


