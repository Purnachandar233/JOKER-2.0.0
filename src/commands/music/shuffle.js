const { EmbedBuilder, Message } = require("discord.js");
const { convertTime } = require('../../utils/convert.js');
const { progressbar } = require('../../utils/progressbar.js')
const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: 'shuffle',
  category: 'music',
  aliases: ["shuf"],
  description: 'shuffles the queue',
  owner: false,
  djonly : false,
  wl : true,
  execute: async (message, args, client, prefix) => {


    let ok = EMOJIS.ok;
    let no = EMOJIS.no;

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
          return await message.channel.send({ embeds: [thing] });
        }
             const player = client.lavalink.players.get(message.guild.id);
           const arr = [
             player?.queue?.current,
             ...(Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [])
           ].filter(Boolean);
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
      if (!Array.isArray(player.queue?.tracks) || player.queue.tracks.length <= 1) {
        return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`${no} Not enough tracks to shuffle.`)] });
      }

      await player.queue.shuffle();

      let thing = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${ok} The queue has been shuffled.`)
      return await message.channel.send({ embeds: [thing] });

        }
}
