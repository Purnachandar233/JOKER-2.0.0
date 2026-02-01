const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const { convertTime } = require('../../utils/convert.js');
const ms = require('ms');
const safePlayer = require('../../utils/safePlayer');
module.exports = {
    name: "seek",
    description: "Seek to a specific time in a song",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    djonly :true,
    wl : true,
    options: [
      {
        name: "time",
        description: "the time example 1m.",
        required: true,
        type: 3
		}
	],

    /**
     * @param {Client} client
     * @param {CommandInteraction} interaction
     */

    run: async (client, interaction, prefix ) => {
        await interaction.deferReply({
          ephemeral: false
        });  
        let ok = client.emoji.ok;
        let no = client.emoji.no;
        
        const time = interaction.options.getString("time");
   //
  
   //
      const { channel } = interaction.member.voice;
      if (!channel) {
                      const noperms = new EmbedBuilder()
                     
           .setColor(interaction.client?.embedColor || '#ff0051')
             .setDescription(`${no} You must be connected to a voice channel to use this command.`)
          return await interaction.followUp({embeds: [noperms]});
      }
      if(interaction.member.voice.selfDeaf) {	
        let thing = new EmbedBuilder()
         .setColor(interaction.client?.embedColor || '#ff0051')

       .setDescription(`${no} <@${interaction.member.id}> You cannot run this command while deafened.`)
         return await interaction.followUp({embeds: [thing]});
       }
            const player = client.lavalink.players.get(interaction.guild.id);
                const { getQueueArray } = require('../../utils/queue.js');
                const tracks = getQueueArray(player);
                if(!player || !tracks || tracks.length === 0) {
                      const noperms = new EmbedBuilder()

           .setColor(interaction.client?.embedColor || '#ff0051')
           .setDescription(`${no} There is nothing playing in this server.`)
          return await interaction.followUp({embeds: [noperms]});
      }
      if(player && channel.id !== player.voiceChannelId) {
                                  const noperms = new EmbedBuilder()
             .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} You must be connected to the same voice channel as me.`)
          return await interaction.followUp({embeds: [noperms]});
      }
		
      const etime = require('ms')(time)
      if(!etime || isNaN(etime))  return await interaction.editReply({ embeds : [
        new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription(`${no} Please specify a vaild time ex: \`1h\`.`)
    ]})
    await safePlayer.safeCall(player, 'seek', etime)
  
    let thing = new EmbedBuilder()
      .setColor(interaction.client?.embedColor || '#ff0051')
      .setDescription(`${ok} seeked to \`${convertTime(player.position)}\``)
    return await interaction.editReply({ embeds: [thing] });
     
       }
     };



