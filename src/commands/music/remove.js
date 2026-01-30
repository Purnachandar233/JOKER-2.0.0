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
 
        const position = (Number(args[0]) - 1);
        if (position > player.queue.size) {
          const number = (position + 1);
          let thing = new EmbedBuilder()
 
            .setColor(0xff0051)
          .setDescription(`${no} No songs at number \`${number}\`. Total songs\`${player.queue.size}```);
           return await message.channel.send({ embeds: [thing] });
        }
      
     const song = player.queue[position]
     player.queue.remove(position);
 
     const emojieject = client.emoji.remove;
   
     let thing = new EmbedBuilder()
       .setColor(0xff0051)
 
       .setDescription(`${ok}  **Removed that song from Queue**`)
     return await message.channel.send({ embeds: [thing] });
      
        }
}

