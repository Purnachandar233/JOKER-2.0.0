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
          if (!args[0]) {
            const emr = new EmbedBuilder()
    
            .setDescription(` ${no} Wrong Command Usage!\n\nUsage: \`move <from> <to>\`\nExample: \`move ${player.queue.size - 2 <= 0 ? player.queue.size : player.queue.size - 2 } 1\``)
            return message.channel.send({embeds: [emr]})
          }
          //If no TO args return error
          if (!args[1]) {
            const ror = new EmbedBuilder()
        
            .setDescription(`${no} Wrong Command Usage!\n\nUsage: \`move <from> <to>\`\nExample: \`move ${player.queue.size - 2 <= 0 ? player.queue.size : player.queue.size - 2 } 1\``)
            return message.channel.send({embeds: [ror]})
          }
          //if its not a number or too big / too small return error
          if (isNaN(args[0]) || args[0] <= 1 || args[0] > player.queue.size) {
            const eoer = new EmbedBuilder()
          
            .setDescription(` ${no} Your Input must be a Number greater then \`1\` and smaller then \`${player.queue.size}\``)
            return message.channel.send({embeds: [eoer]})
          }
          //get the new Song
          let song = player.queue[player.queue.size - 1];
          //move the Song to the first position using my selfmade Function and save it on an array
          let QueueArray = arrayMove(player.queue, player.queue.size - 1, 0);
          //clear teh Queue
          while (player.queue.size > 0) { player.queue.remove(0); };
          //now add every old song again
          for (const track of QueueArray)
            player.queue.add(track);
          //send informational message
          const ifkf = new EmbedBuilder()
         .setColor(0xff0051)
          .setDescription(` ${ok} Moved the Song in the Queue from Position \`${args[0]}\` to Position: \`${args[1]}\`\n\n[${song.info?.title || song.title}](https://www.youtube.com/watch?v=dQw4w9WgXcQ) - \`${format(song.info?.duration || song.duration)}\` `)
          return message.channel.send({embeds: [ifkf]});
        }
    }
