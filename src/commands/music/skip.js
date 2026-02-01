const { EmbedBuilder, Message } = require("discord.js");
const { convertTime } = require('../../utils/convert.js');
const { progressbar } = require('../../utils/progressbar.js');
const twentyfourseven = require('../../schema/twentyfourseven.js');
module.exports = {
  name: 'skip',
  category: 'music',
  aliases: ["skp"],
  description: 'skips the current song. ',
  owner: false,
  wl : true,
  
  execute: async (message, args, client, prefix) => {
      
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
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

       

        try {
          const safePlayer = require('../../utils/safePlayer');
          const upcomingArr = arr || [];
          const reportedSize = (typeof player.queue?.totalSize === 'number') ? player.queue.totalSize : (typeof player.queue?.size === 'number' ? player.queue.size : 0);
          const upcomingCount = Math.max(0, upcomingArr.length, reportedSize - (player.queue?.current ? 1 : 0));

          // Skip diagnostics removed to reduce logging noise

          try {
            await safePlayer.safeStop(player);
          } catch (e) {
            try { await safePlayer.safeStop(player); } catch (_) {}
          }

          if (upcomingCount > 0) {
            return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`${ok} Skipping to the next track.`)] }).catch(() => {});
          }

          const twentyfourseven = require('../../schema/twentyfourseven.js');
          const is247Enabled = await twentyfourseven.findOne({ guildID: message.guild.id });
          if (is247Enabled) {
            return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`${no} No songs in queue, add more to skip.`)] }).catch(() => {});
          }

          try { await safePlayer.safeDestroy(player); } catch (e) {}
          return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`${ok} Skipped the last track. No more tracks in queue.`)] }).catch(() => {});
          } catch (err) {
          client.logger?.log(`Skip command error: ${err?.message || err}`, 'error');
          try { client.logger?.log(err && (err.stack || err.toString()), 'error'); } catch (e) { console.error('Skip command full error', err); }
          return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`${no} Failed to skip track.`)] }).catch(() => {});
        }
  }
}

