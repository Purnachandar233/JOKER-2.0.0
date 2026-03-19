const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: 'stop',
  category: 'music',
  aliases: ["stp"],
  description: 'stops the player and clears the queue.',
  owner: false,
  djonly : false,
  wl : true,
  execute: async (message, args, client, prefix) => {

    let ok = EMOJIS.ok;
    let no = EMOJIS.no;



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
           const tracks = [
             player?.queue?.current,
             ...(Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [])
           ].filter(Boolean);
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
       try {
         await player.stopPlaying(true, false);
         await player.destroy().catch(() => {});
       } catch (e) {
         try { client.logger?.log(`Stop command error: ${e && (e.stack || e.toString())}`, 'error'); } catch (err) { console.error(e); }
         try { await player.destroy().catch(() => {}); } catch (_) {}
       }

       const emojistop = EMOJIS.stop;

       let thing = new EmbedBuilder()
       .setColor(message.client?.embedColor || '#ff0051')
       .setDescription(`${ok} **Stopped the player and cleared the queue!**`)
       return message.channel.send({embeds: [thing]});

     }
}
