const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const twentyfourseven = require("../../schema/twentyfourseven");
const autoplaySchema = require("../../schema/autoplay.js");

module.exports = {
  name: "autoplay",
  category: "settings",
  description: "Toggles autoplay mode",
  owner: false,
  premium: true,
  votelock:true,
  djonly : true,
  wl : true,
  execute: async (message, args, client, prefix) => {  
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    

    
    //
       const { channel } = message.member.voice;
       if (!channel) {
                       const noperms = new EmbedBuilder()
 
            .setColor(message.client.embedColor)
              .setDescription(`${no} You must be connected to a voice channel to use this command.`)
           return await message.channel.send({embeds: [noperms]});
       }
       if(message.member.voice.selfDeaf) {      
         let thing = new EmbedBuilder()
          .setColor(message.client.embedColor)
 
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`)
          return await message.channel.send({embeds: [thing]});
        }
                 const safePlayer = require('../../utils/safePlayer');
                 const { getQueueArray } = require('../../utils/queue.js');
                 const player = client.lavalink.players.get(message.guild.id);
                 const tracks = getQueueArray(player);
                 if(!player || !tracks || tracks.length === 0) {
                      const noperms = new EmbedBuilder()
 
                        .setColor(message.client.embedColor)
            .setDescription(`${no} There is nothing playing in this server.`)
           return await message.channel.send({embeds: [noperms]});
       }
         if(player && channel.id !== player.voiceChannelId) {
                       const noperms = new EmbedBuilder()
            .setColor(message.client.embedColor || client?.config?.embedColor || '#ff0051')
           .setDescription(`${no} You must be connected to the same voice channel as me.`)
           return await message.channel.send({embeds: [noperms]});
       }
         
     
       const autoplay = player.get("autoplay");
       if (autoplay === false) {
         const identifier = tracks[0]?.identifier || tracks[0]?.info?.identifier;
         player.set("autoplay", true);
         player.set("requester", message.member.id);
         player.set("identifier", identifier);
         const search = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
         const res = await player.search(search, message.member);
         if (!res || res.loadType === 'LOAD_FAILED' || res.loadType !== 'PLAYLIST_LOADED' || res.loadType === 'NO_MATCHES') {
           let embed = new EmbedBuilder()
           .setDescription(`Found nothing related for the latest song!`)
           .setColor(message.client.embedColor || client?.config?.embedColor || '#ff0051')
           try {
             client.channels.cache.get(player.textChannelId).send({embeds: [embed]})
           } catch (e) {  }
         }
         // Clear the queue
         await safePlayer.queueClear(player);
         safePlayer.queueAdd(player, res.tracks[0])
         let thing = new EmbedBuilder()
         .setColor(message.client.embedColor)
             .setDescription(`${ok} Starting to play recommended tracks.`)
             return await message.channel.send({embeds: [thing]});
     } else {
         player.set("autoplay", false);
         // Clear the queue
         await safePlayer.queueClear(player);
         let thing = new EmbedBuilder()
         .setColor(message.client.embedColor)
             .setDescription(`${ok} I have stopped to play recommended tracks.`)
            
             return await message.channel.send({embeds: [thing]});
         
     }
 
      
        }
}

