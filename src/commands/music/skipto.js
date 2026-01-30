const { EmbedBuilder, Message } = require("discord.js");
const { convertTime } = require('../../utils/convert.js');
const { progressbar } = require('../../utils/progressbar.js')
module.exports = {
  name: 'skipto',
  category: 'music',
  aliases: ["skp"],
  description: 'skips to a specific song in the queue.',
  owner: false,
  djonly : true,
  wl : true,
  execute: async (message, args, client, prefix) => {
      
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
    const number = args.join(" ")
    //
   
    //
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
           const player = client.lavalink.players.get(message.guild.id);
       if(!player || !player.queue.current) {
                       const noperms = new EmbedBuilder()
 
            .setColor(0xff0051)
            .setDescription(`${no} There is nothing playing in this server.`)
           return await message.channel.send({embeds: [noperms]});
       }
       if(player && channel.id !== player.voiceChannelId) {
                                   const noperms = new EmbedBuilder()
              .setColor(0xff0051)
           .setDescription(`${no} You must be connected to the same voice channel as me.`)
           return await message.channel.send({embeds: [noperms]});
       }
       const position = number;
 
       if (position < 0 || position > player.queue.size) { 
           let ething = new EmbedBuilder()
           .setColor(0xff0051)
           .setDescription(`${no} Track not found`)
           return await message.channel.send({ embeds: [ething] });
       }
      
 
     player.queue.remove(0, position - 1);
     player.stop();
     let thing = new EmbedBuilder()
     .setDescription(`${ok} Skipped **${position}** track(s).`)
     .setColor(message.client.embedColor)
     return await message.channel.send({ embeds: [thing] });
 
        }
}

