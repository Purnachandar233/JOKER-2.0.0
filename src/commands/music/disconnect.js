const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
  name: 'disconnect',
  category: 'music',
  aliases: ["dc","leave","leavevc","mingey"],
  description: 'leaves the voice channel',
  owner: false,
  djonly : true,
  wl : true,
  execute: async (message, args, client, prefix) => {
     
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
    const { channel } = message.member.voice;
    //
  
    //
  if (!channel) {
                  const noperms = new EmbedBuilder()

       .setColor(0xff0051)
         .setDescription(`${no} You must be connected to a voice channel to use this command.`)
      return await message.channel.send({embeds: [noperms]});
  }
  if(message.member.voice.selfDeaf) {   
    let thing = new EmbedBuilder()
     .setColor(0xff0051)
  
   .setDescription(` ${no} You cannot run this command while deafened.`)
     return await message.channel.send({embeds: [thing]});
   }
    const player = client.lavalink.players.get(message.guild.id);
 
      player.destroy();
      const msg = player.get(`playingsongmsg`);
      if (msg && msg.delete) {
          msg.delete().catch(() => {});
      }

      let thing = new EmbedBuilder()
      .setColor(0xff0051)
      .setDescription(`${ok} Destroyed the player and left ${botchannel}`)
      return message.channel.send({ embeds: [thing] });
      
      }
}
