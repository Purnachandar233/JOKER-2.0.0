const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
  name: 'stop',
  category: 'music',
  aliases: ["apu"],
  description: 'stops the player and clears the queue.',
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
       const autoplay = player.get("autoplay")
       if (autoplay === true) {
           player.set("autoplay", false);
       }

       player.stop();
      while (player.queue.size > 0) { player.queue.remove(0); };
 
       const emojistop = client.emoji.stop;

       let thing = new EmbedBuilder()
       .setColor(0xff0051)
       .setDescription(`${ok} **Stopped the player and cleared the queue!**`)
       return message.channel.send({embeds: [thing]});
   
     }
}


