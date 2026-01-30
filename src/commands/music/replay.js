const { EmbedBuilder, Message } = require("discord.js");
const { progressbar } = require('../../utils/progressbar.js')
module.exports = {
  name: 'replay',
  category: 'music',
  aliases: ["mallipadu","inkosary","rewind"],
  description: 'Pauses the player.',
  owner: false,
  djonly : true,
  wl : true,
  execute: async (message, args, client, prefix) => {
     
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
  
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


       player.seek(0);
              
       let thing = new EmbedBuilder()

           .setColor(0xff0051)
           .setDescription(`${ok} Restarting [${player.queue.current.title}](https://www.youtube.com/watch?v=dQw4w9WgXcQ)`);
       return  await message.channel.send({embeds: [thing]});

       
   
   }
}

