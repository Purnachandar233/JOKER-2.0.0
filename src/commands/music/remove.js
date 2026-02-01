const { EmbedBuilder, Message } = require("discord.js");
const { progressbar } = require('../../utils/progressbar.js')
module.exports = {
  name: 'remove',
  category: 'music',
  aliases: ["nikal","tesey"],
  description: 'removes a song from the queue.',
  owner: false,
  wl : true,
  djonly : true,
  execute: async (message, args, client, prefix) => {
   
    
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
    //
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
           const arr = getQueueArray(player);
           if(!player || !arr || arr.length === 0) {
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
          const posNum = Number(args[0]);
        if (!Number.isFinite(posNum) || posNum < 1) {
          return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`${no} Invalid track number.`)] });
        }
        // arr already computed above
        if (posNum > arr.length) {
          return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`${no} No songs at number \`${posNum}\`. Total songs: \`${arr.length}\``)] });
        }

     const song = arr[posNum - 1];
    const safePlayer = require('../../utils/safePlayer');
    safePlayer.queueRemove(player, posNum - 1);
 
     const emojieject = client.emoji.remove;
   
     let thing = new EmbedBuilder()
       .setColor(message.client?.embedColor || '#ff0051')
 
       .setDescription(`${ok}  **Removed that song from Queue**`)
     return await message.channel.send({ embeds: [thing] });
      
        }
}

