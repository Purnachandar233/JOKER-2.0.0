const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const twentyfourseven = require("../../schema/twentyfourseven")

module.exports = {
  name: "moveme",
  category: "settings",
  description: "Moves you to the bots voice channel!",
  owner: false,
  wl : true,

  execute: async (message, args, client, prefix) => {
      
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
    let channel = message.member.voice.channel;
    let botchannel = message.guild.members.me?.voice?.channel;
    
    // Validate bot is in a voice channel
    if(!botchannel) {
        const ifkf = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} I am not connected to any voice channel`)
        return message.channel.send({embeds: [ifkf]})
    }
    
    // Validate user is in a voice channel
    if(!channel) {
        const dd = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} Please connect to a voice channel first`)
        return message.channel.send({embeds: [dd]})
    }
    
    // Check if user is already in bot's channel
    if(botchannel.id === channel.id) {
        const tt = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} You are already in my channel`)
        return message.channel.send({embeds: [tt]})
    }
    
    // Safely check channel limit
    if(botchannel.userLimit > 0 && botchannel.members && botchannel.userLimit <= botchannel.members.size) {
        const idkd = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} Sorry my channel is full, I can't move you`)
        return message.channel.send({embeds: [idkd]})
    }
        }
        message.member.voice.setChannel(botchannel);
        const ioop = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${ok} moved you to: \`${botchannel.name}\``)
        return message.channel.send({embeds: [ioop]});
      }
     }

