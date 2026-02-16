const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const { convertTime } = require('../../utils/convert.js');
const ms = require('ms');
const safePlayer = require('../../utils/safePlayer');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: 'rewind',
  category: 'music',
  aliases: ["rew","rewd"],
  description: 'rewinds a song.',
  owner: false,
  djonly : true,
  wl : true,
  execute: async (message, args, client, prefix) => {

    let ok = EMOJIS.ok;
    let no = EMOJIS.no;

    const time = args.join(" ")
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



     if (!time[0]) {
        const ppp = new EmbedBuilder()
        .setDescription(`${no} Please specify a valid time ex: \`1m\`.`)
        return message.channel.send({embeds: [ppp]});
      }
      const etime = ms(time);
      if (!Number.isFinite(etime) || etime <= 0) {
        const ppp = new EmbedBuilder()
          .setColor(message.client?.embedColor || '#ff0051')
          .setDescription(`${no} Please provide a valid rewind duration ex: \`1m\`.`);
        return message.channel.send({ embeds: [ppp] });
      }

      const seektime = Math.max(0, Number(player.position) - Number(etime));
      await safePlayer.safeCall(player, 'seek', seektime);

      let thing = new EmbedBuilder()
        .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${ok} Rewound to \`${convertTime(seektime)}\``);
      return await message.channel.send({ embeds: [thing] });

        }
}

