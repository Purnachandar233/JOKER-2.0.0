const { EmbedBuilder, Message } = require("discord.js");
const { convertTime } = require('../../utils/convert.js');
const { progressbar } = require('../../utils/progressbar.js')
module.exports = {
  name: 'shuffle',
  category: 'music',
  aliases: ["shuf"],
  description: 'skips the current song. ',
  owner: false,
  djonly : true,
  wl : true,
  execute: async (message, args, client, prefix) => {

      
    let ok = client.emoji.ok;
    let no = client.emoji.no;
 
    //
       const { channel } = message  .member.voice;
       if (!channel) {
                       const noperms = new EmbedBuilder()
                      
            .setColor(message.client?.embedColor || '#ff0051')
              .setDescription(`${no} You must be connected to a voice channel to use this command.`)
           return await message.channel.send({embeds: [noperms]});
       }
       if(message   .member.voice.selfDeaf) {	
         let thing = new EmbedBuilder()
          .setColor(message.client?.embedColor || '#ff0051')
 
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`)
          return await message  .followUp({embeds: [thing]});
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
      if (arr.length <= 1) return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`${no} Not enough tracks to shuffle.`)] });

      // Fisher-Yates shuffle
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }

      const safePlayer = require('../../utils/safePlayer');
      await safePlayer.queueClear(player);
      safePlayer.queueAdd(player, arr);

      let thing = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${ok} The queue has been shuffled.`)
      return await message.channel.send({ embeds: [thing] });
      
        }
}

