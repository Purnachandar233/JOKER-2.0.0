const { EmbedBuilder, Message } = require("discord.js");
const { now } = require("mongoose");
const { convertTime } = require('../../utils/convert.js');
const { progressbar } = require('../../utils/progressbar.js')
module.exports = {
  name: 'join',
  category: 'music',
  aliases: ["vcdha","vcra","j"],
  description: 'grabs and send the current playing song data to your personal dms',
  owner: false,
  wl : true,
  execute: async (message, args, client, prefix) => {
     
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
    const { channel } = message.member.voice;
    if (!channel) {
                    const noperms = new EmbedBuilder()
         .setColor(0xff0051)
           .setDescription(`${no} You must be connected to a voice channel to use this command.`)
        return await message.channel.send({embeds: [noperms]});
    }
    if(message.member.voice.selfDeaf) {	
      let thing = new EmbedBuilder()
       .setColor(0xff0051)
     .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`)
       return await message.channel.send({embeds: [thing]});
     }


     if (!client.lavalink) {
         return await message.channel.send({embeds: [new EmbedBuilder().setColor(0xff0051).setDescription(`${no} Lavalink is not connected yet. Please try again in a moment.`)]});
     }

     let player = client.lavalink.players.get(message.guild.id);
     if(!player) {

         player = client.lavalink.createPlayer({
             guildId: message.guild.id,
             voiceChannelId: channel.id,
             textChannelId: message.channel.id,
             selfDeafen: true,
         });

         player.connect();

         let thing = new EmbedBuilder()
             .setColor(0xff0051)
                         .setDescription(`${ok} Connected to \`${channel.name}\``)
                         return await message.channel.send({embeds: [thing]});

     } else if (message.guild.members.me?.voice?.channel !== channel) {

         let thing = new EmbedBuilder()
 
               .setColor(0xff0051)
             .setDescription(`${no} You must be in the same channel as me.`);
             return await message.channel.send({embeds: [thing]});
     }
     
     else if(player){
         const noperms = new EmbedBuilder()
   
         .setColor(0xff0051)
         .setDescription(`${no} I am already connected to a voice channel.`)
         return await message.channel.send({embeds: [noperms]});
     }

  }
}