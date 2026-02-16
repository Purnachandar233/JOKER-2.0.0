const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: 'removedupes',
  category: 'music',
  aliases: ["removedp","removeduplicate","remdupe"],
  description: 'removes all duplicated tracks in the queue.',
  owner: false,
  votelock:true,
  wl : true,
  djonly : true,
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

          const safePlayer = require('../../utils/safePlayer');
       const newtracks = [];
           for (let i = 0; i < tracks.length; i++) {
         let exists = false;
         for (let j = 0; j < newtracks.length; j++) {
           if ((tracks[i].info?.uri || tracks[i].uri) === (newtracks[j].info?.uri || newtracks[j].uri)) {
             exists = true;
             break;
           }
         }//removedupes
         if (!exists) {
           newtracks.push(tracks[i]);
         }
       }
      //clear the Queue
     await safePlayer.queueClear(player);
       //now add every not dupe song again
       safePlayer.queueAdd(player, newtracks);
       //Send Success Message
        return await message.channel.send({ embeds : [new EmbedBuilder().setDescription(`${ok} Removed all the duplicates songs from the queue.`)
       .setColor(message.client?.embedColor || '#ff0051')
 ]})

        }
}

