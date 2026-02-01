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
       const autoplay = player.get("autoplay")
       if (autoplay === true) {
           player.set("autoplay", false);
       }

       player.set("stopped", true);
       const safePlayer = require('../../utils/safePlayer');
       try {
         if (typeof player.stop === 'function') {
           await safePlayer.safeStop(player);
         } else if (typeof player.skip === 'function') {
           await safePlayer.safeStop(player);
         } else if (typeof player.destroy === 'function') {
           // fallback: destroy player to ensure playback stops
           await safePlayer.safeDestroy(player);
         } else if (typeof player.pause === 'function') {
           await safePlayer.safeCall(player, 'pause', true);
         }
       } catch (e) {
         try { client.logger?.log(`Stop command error: ${e && (e.stack || e.toString())}`, 'error'); } catch (err) { console.error(e); }
         try { await safePlayer.safeDestroy(player); } catch (_) {}
       }

       // Clear queue safely
      try { await safePlayer.queueClear(player); } catch (e) {}
 
       const emojistop = client.emoji.stop;

       let thing = new EmbedBuilder()
       .setColor(message.client?.embedColor || '#ff0051')
       .setDescription(`${ok} **Stopped the player and cleared the queue!**`)
       return message.channel.send({embeds: [thing]});
   
     }
}


