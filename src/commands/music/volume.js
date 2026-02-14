const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const safePlayer = require('../../utils/safePlayer');

module.exports = {
  name: 'volume',
  category: 'music',
  aliases: ["vo","vol","volum"],
  description: 'plays some high quality music for you',
  owner: false,
  djonly : false,
  votelock:true,
  wl : true,
  execute: async (message, args, client, prefix) => {
      
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
   
    const volume = args.join(" ")
   //
     const djSchema = require('../../schema/djroleSchema')
     let djdata = await djSchema.findOne({ guildID: message.guild.id })
     if (djdata && djdata.Roleid) {
       if (!message.member.roles.cache.has(djdata.Roleid)) {
         // role configured but user doesn't have it
         const embed = new EmbedBuilder()
         .setColor(message.client?.embedColor || '#ff0051')
         .setDescription(`${no} This command requires you to have <@&${djdata.Roleid}>.`)
         return await message.channel.send({embeds: [embed]});
       }
     }
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
                
      if (isNaN(volume) || volume < 0 || volume > 100) { 
          let ething = new EmbedBuilder()
      
          .setColor(message.client?.embedColor || '#ff0051')
          .setDescription(`${no} Please use a number between \`0\` - \`100\``)
          return await message.channel.send({ embeds: [ething] });
      }
      await safePlayer.safeSetVolume(player, Number(volume));
  
    let thing = new EmbedBuilder()
      .setColor(message.client?.embedColor || '#ff0051')
      .setDescription(`${ok} The volume has been changed to **${volume}%**`)
    return await message.channel.send({ embeds: [thing] });
     
       }
}
