const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
  name: 'loop',
  category: 'music',
  aliases: [],
  description: 'enables / disables the track loop or queue loop',
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
                      
            .setColor(message.client?.embedColor || '#ff0051')
              .setDescription(`${no} You must be connected to a voice channel to use this command.`)
           return await message.channel.send({embeds: [noperms]});
       }
       if(message.member.voice.selfDeaf) {	
         let thing = new EmbedBuilder()
          .setColor(message.client?.embedColor || '#ff0051')
 
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`)
          return await message.channel.send({embeds: [thing]});
        }
             const player = client.lavalink.players.get(message.guild.id);
           const { getQueueArray } = require('../../utils/queue.js');
           const tracks = getQueueArray(player);
           if(!player || !tracks || tracks.length === 0) {
                       const noperms = new EmbedBuilder()
 
            .setColor(message.client?.embedColor || '#ff0051')
            .setDescription(`${no} There is nothing playing in this server.`)
           return await message.channel.send({embeds: [noperms]});
       }
      if(player && channel.id !== player.voiceChannelId) {
                                   const noperms = new EmbedBuilder()
              .setColor(message.client?.embedColor || '#ff0051')
           .setDescription(`${no} You must be connected to the same voice channel as me.`)
           return await message.channel.send({embeds: [noperms]});
       }
       const validoptions = ["song","queue","disable"];
    if(!validoptions.includes(args[0])) {
        const noperms = new EmbedBuilder()
         .setColor(message.client?.embedColor || '#ff0051')
         .setDescription(`${no} **Please specify a loop method\n 
         Ex: \`loop queue\` , \`loop song\`,\`loop disable\`**`)
         return message.channel.send({embeds: [noperms]});
    
       }
      
    
         else
     
       if (['track', 'song'].includes(args[0])) {
     player.setRepeatMode(player.repeatMode === 'track' ? 'off' : 'track');
     const trackRepeat = player.repeatMode === 'track' ? "enabled" : "disabled";
     let thing = new EmbedBuilder()
     .setColor(message.client.embedColor)
     .setDescription(`${ok} Looping the track is now \`${trackRepeat}\``)
     return await message.channel.send({embeds: [thing]});

 }
 else
 if (['q', 'queue'].includes(args[0])) {
     player.setRepeatMode(player.repeatMode === 'queue' ? 'off' : 'queue');
     const queueRepeat = player.repeatMode === 'queue' ? "enabled" : "disabled";
     let thing = new EmbedBuilder()
     .setColor(message.client.embedColor)
     .setDescription(`${ok} Looping the queue is now \`${queueRepeat}\``)
     return await message.channel.send({embeds: [thing]});

 }
 else
 if (['stop', 'disable'].includes(args[0])) {
     player.setRepeatMode('off');
     let thing = new EmbedBuilder()
     .setColor(message.client.embedColor)
     .setDescription(`${ok} Disabled all looping options.`)
     return await message.channel.send({embeds: [thing]});

 }
        }
}
