const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
  name: 'clearqueue',
  category: 'music',
  aliases: ["cq","clear","removeall","annitesai","deletequeue"],
  description: 'plays some high quality music for you',
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
       
            while (player.queue.size > 0) { player.queue.remove(0); };


         let thing = new EmbedBuilder()
     .setColor(0xff0051)
        .setDescription(`${ok} The queue has been cleared.`)
        return message.channel.send({embeds: [thing]});
   
   }
}


