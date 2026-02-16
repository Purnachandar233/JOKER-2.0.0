const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const twentyfourseven = require("../../schema/twentyfourseven")

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "24/7",
  category: "settings",
  description: "Toggles 24/7 mode",
  owner: false,
  premium: true,
  votelock: true,
  wl : true,
  execute: async (message, args, client, prefix) => {

    let ok = EMOJIS.ok;
    let no = EMOJIS.no;


    if (!message.member.permissions.has('MANAGE_CHANNELS')) {
        const noperms = new EmbedBuilder()
       .setColor(message.client?.embedColor || '#ff0051')
       .setDescription(`${no} You need this required Permissions: \`MANAGE_CHANNELS\` to run this command.`)
  return await message.channel.send({embeds: [noperms]});
    }
    const { channel } = message.member.voice;
    if (!channel) {
                    const noperms = new EmbedBuilder()

         .setColor(message.client?.embedColor || '#ff0051')
           .setDescription(`${no} You must be connected to a voice channel to use this command.`)
        return await message.channel.send({embeds: [noperms]});
    }



  const player = client.lavalink.players.get(message.guild.id);
  if(!player){
    const jplayer = client.lavalink.createPlayer({
      guildId: message.guild.id,
      voiceChannelId: channel.id,
      textChannelId: message.channel.id,
      selfDeafen: true,
  });
  const safePlayer = require('../../utils/safePlayer');
  await safePlayer.safeCall(jplayer, 'connect');
  }
   let   data = await twentyfourseven.findOne({
          guildID: message.guild.id
      })
      if(!data) {
        const { channel } = message.member.voice;
          let newData = await twentyfourseven.create({
            guildID: message.guild.id,
            voiceChannel: channel.id,
            textChannel: message.channel.id
          })
          newData.save();
          const embed = new EmbedBuilder()
          .setColor(message.client.embedColor)
          .setDescription(`${ok} 24/7 mode is now \`enabled\`.`)
          return await message.channel.send({ embeds : [embed]})
      }else{
            await  twentyfourseven.deleteMany({ guildID: message.guild.id });
            const embed = new EmbedBuilder()
            .setColor(message.client.embedColor)
            .setDescription(`${ok} 24/7 mode is now \`disabled\`.`)
            return await message.channel.send({ embeds : [embed]})

      }

     }
}