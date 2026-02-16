const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const twentyfourseven = require("../../schema/twentyfourseven");
const autoplaySchema = require("../../schema/autoplay.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "autoplay",
  category: "settings",
  description: "Toggles autoplay mode",
  owner: false,
  premium: true,
  votelock:true,
  djonly : false,
  wl : true,
  execute: async (message, args, client, prefix) => {
    let ok = EMOJIS.ok;
    let no = EMOJIS.no;



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
         const identifier = tracks[0]?.identifier || tracks[0]?.info?.identifier || null;
         const title = tracks[0]?.info?.title || tracks[0]?.title || '';
         const author = tracks[0]?.info?.author || tracks[0]?.author || '';
         const query = (title ? `${title} ${author}`.trim() : null);

         player.set("autoplay", true);
         player.set("requester", null);
         player.set("requesterId", message.member.id);
         player.set("identifier", identifier);
         player.set("autoplayQuery", query);

         const autoplaySchema = require('../../schema/autoplay.js');
         await autoplaySchema.findOneAndUpdate(
           { guildID: message.guild.id },
           { enabled: true, requesterId: message.member.id, identifier: identifier, query: query, lastUpdated: Date.now() },
           { upsert: true }
         );

         // Try searching non-YouTube sources using query
         let res = null;
         if (query) {
           const sources = ['spotify', 'soundcloud', 'bandcamp', 'deezer', 'applemusic'];
           for (const source of sources) {
             try {
               const sp = player.search({ query, source }, message.member);
               const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('search timeout')), 8000));
               const r = await Promise.race([sp, timeout]).catch(() => null);
               if (r && r.tracks && r.tracks.length > 0) { res = r; break; }
             } catch (_) { continue; }
           }
         }

         if (!res || !res.tracks || res.tracks.length === 0) {
           let embed = new EmbedBuilder().setDescription(`Found nothing related for the latest song!`).setColor(message.client.embedColor || client?.config?.embedColor || '#ff0051');
           try { client.channels.cache.get(player.textChannelId).send({embeds: [embed]}) } catch (e) {}
         } else {
           await safePlayer.queueClear(player);
           safePlayer.queueAdd(player, res.tracks[0]);
         }

         let thing = new EmbedBuilder().setColor(message.client.embedColor).setDescription(`${ok} Starting to play recommended tracks.`)
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

