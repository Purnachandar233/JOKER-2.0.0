const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ChannelType } = require("discord.js");
const twentyfourseven = require("../../schema/twentyfourseven")

module.exports = {
  name: "movebot",
  category: "settings",
  description: "Moves the bot to your voice channel!",
  owner: false,
  wl : true,

  execute: async (message, args, client, prefix) => {
      
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
    const channel = message.member.voice.channel;
    
    // Validate user is in a voice channel
    if(!channel) {
        const nvc = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} Please connect to a voice channel first`)
        return message.channel.send({embeds: [nvc]})
    }
    
    const botChannel = message.guild.members.me?.voice?.channel;
    
    // Validate bot has a voice channel
    if(!botChannel) {
        const nobot = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} I am not connected to any voice channel`)
        return message.channel.send({embeds: [nobot]})
    }
    
    // Check if already in same channel
    if(channel.id === botChannel.id) {
        const ttt = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} I am already in your channel`)
        return message.channel.send({embeds: [ttt]})
    }
    
    const player = client.lavalink.players.get(message.guild.id)
    const opop = new EmbedBuilder()
    .setColor(0xff0051)
    .setDescription(`${ok} Joining your channel`)
    await message.channel.send({embeds: [opop]}).then(async msg => {
        const tne = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(` Trying to continue the player!`)
        msg.edit({embeds: [tne]}).then(async msg => {
            await message.guild.members.me?.voice.setChannel(message.member.voice.channel, "Resume queue in new channel");
            if(channel.type === ChannelType.GuildStageVoice) {
                await message.guild.members.me?.voice.setSuppressed(false)
            }
            const rrr = new EmbedBuilder()
            .setColor(0xff0051)
            .setDescription(`${ok} Successfully continued queue!`)
            msg.edit({embeds: [rrr]})
        })
    })
     }
}
