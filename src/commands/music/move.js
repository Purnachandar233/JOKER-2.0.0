const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const {
    format,
    arrayMove
  } = require(`../../functions.js`);
module.exports = {
  name: 'move',
  category: 'music',
  aliases: ["side"],
  description: 'Change the position of a track in the queue.',
  owner: false,
  wl : true,
  execute: async (message, args, client, prefix) => {
  
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
     const player = client.lavalink.players.get(message.guild.id);
          //if no FROM args return error
          const safePlayer = require('../../utils/safePlayer');
          if (!args[0]) {
            const emr = new EmbedBuilder()
    
            .setDescription(` ${no} Wrong Command Usage!\n\nUsage: \`move <from> <to>\`\nExample: \`move ${safePlayer.queueSize(player) - 2 <= 0 ? safePlayer.queueSize(player) : safePlayer.queueSize(player) - 2 } 1\``)
            return message.channel.send({embeds: [emr]})
          }
          //If no TO args return error
          if (!args[1]) {
            const ror = new EmbedBuilder()
        
            .setDescription(`${no} Wrong Command Usage!\n\nUsage: \`move <from> <to>\`\nExample: \`move ${safePlayer.queueSize(player) - 2 <= 0 ? safePlayer.queueSize(player) : safePlayer.queueSize(player) - 2 } 1\``)
            return message.channel.send({embeds: [ror]})
          }
          //if its not a number or too big / too small return error for from
          if (isNaN(args[0]) || args[0] < 1 || args[0] > safePlayer.queueSize(player)) {
            const eoer = new EmbedBuilder()

            .setDescription(` ${no} Your Input for 'from' must be a Number between \`1\` and \`${safePlayer.queueSize(player)}\``)
            return message.channel.send({embeds: [eoer]})
          }
          //if its not a number or too big / too small return error for to
          if (isNaN(args[1]) || args[1] < 1 || args[1] > safePlayer.queueSize(player)) {
            const eoer = new EmbedBuilder()

            .setDescription(` ${no} Your Input for 'to' must be a Number between \`1\` and \`${safePlayer.queueSize(player)}\``)
            return message.channel.send({embeds: [eoer]})
          }
          const { getQueueArray } = require('../../utils/queue.js');
          const arr = getQueueArray(player);
          const fromIndex = Number(args[0]) - 1;
          const toIndex = Number(args[1]) - 1;
          const song = arr[fromIndex];
          const QueueArray = arrayMove(arr, fromIndex, toIndex);
          await safePlayer.queueClear(player);
          safePlayer.queueAdd(player, QueueArray);
          //send informational message
          const ifkf = new EmbedBuilder()
         .setColor(message.client?.embedColor || '#ff0051')
          .setDescription(` ${ok} Moved the Song in the Queue from Position \`${args[0]}\` to Position: \`${args[1]}\`\n\n[${song?.info?.title || song?.title || 'Track'}](https://www.youtube.com/watch?v=dQw4w9WgXcQ) - \`${format(song?.info?.duration || song?.duration || 0)}\` `)
          return message.channel.send({embeds: [ifkf]});
        }
    }
