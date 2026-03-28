const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: 'clearqueue',
  category: 'music',
  aliases: ["cq","clear","removeall","annitesai","deletequeue"],
  description: 'clears the queue',
  owner: false,
  djonly : true,
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
       if(!player) {
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

          if (typeof player.queue?.clear === 'function') {
            await player.queue.clear().catch(() => {});
          } else if (Array.isArray(player.queue?.tracks) && typeof player.queue.splice === 'function') {
            await player.queue.splice(0, player.queue.tracks.length).catch(() => {});
          } else if (Array.isArray(player.queue?.tracks)) {
            player.queue.tracks.length = 0;
          }

         let thing = new EmbedBuilder()
     .setColor(message.client?.embedColor || '#ff0051')
        .setDescription(`${ok} The queue has been cleared.`)
        return message.channel.send({embeds: [thing]});

   }
}
