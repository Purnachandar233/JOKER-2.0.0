const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");

module.exports = {
    name: "skipto",
    description: "Skips to a certain track.",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    djonly :true,
    wl : true,
    options: [
      {
        name: "number",
        description: "Number of song in queue",
        required: true,
        type: 4
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
        
      const number = interaction.options.getNumber("number");
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
                const safePlayer = require('../../utils/safePlayer');
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
      const position = number;

      const qSize = safePlayer.queueSize(player);
      if (position < 0 || position > qSize) { 
          let ething = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} Track not found`)
          return await interaction.editReply({ embeds: [ething] });
      }
    
    safePlayer.queueRemove(player, 0, position - 1);
      // use stop to advance playback reliably
      await safePlayer.safeStop(player);
    let thing = new EmbedBuilder()
    .setDescription(`${ok} Skipped **${position}** track(s).`)
    .setColor(interaction.client.embedColor)
    return await interaction.editReply({ embeds: [thing] });

       }
     };


