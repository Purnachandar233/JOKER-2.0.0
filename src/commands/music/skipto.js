const { EmbedBuilder, Message } = require("discord.js");
const { convertTime } = require('../../utils/convert.js');
const { progressbar } = require('../../utils/progressbar.js')
const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: 'skipto',
  category: 'music',
  aliases: ["skt"],
  description: 'skips to a specific song in the queue.',
  owner: false,
  djonly : false,
  wl : true,
  execute: async (message, args, client, prefix) => {

    let ok = EMOJIS.ok;
    let no = EMOJIS.no;

    const number = args.join(" ")
    //

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
       if(!player || !player.queue.current) {
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
       const position = Number(number);

       if (!Number.isFinite(position) || position < 1) {
         return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`${no} Track not found`)] });
       }

     const { getQueueArray } = require('../../utils/queue.js');
     const arr = getQueueArray(player);
     if (position > arr.length) {
       return await message.channel.send({ embeds: [new EmbedBuilder().setColor(message.client?.embedColor || '#ff0051').setDescription(`${no} Track not found`)] });
     }

     // Keep tracks from position..end
     const remaining = arr.slice(position - 1);
    const safePlayer = require('../../utils/safePlayer');
    await safePlayer.queueClear(player);
    safePlayer.queueAdd(player, remaining);
    await safePlayer.safeStop(player);
     let thing = new EmbedBuilder()
     .setDescription(`${ok} Skipped **${position}** track(s).`)
     .setColor(message.client.embedColor)
     return await message.channel.send({ embeds: [thing] });

        }
}

