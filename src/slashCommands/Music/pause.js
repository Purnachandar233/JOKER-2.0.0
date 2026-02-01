const { EmbedBuilder, CommandInteraction, Client } = require("discord.js")

module.exports = {
    name: "pause",
    description: "Pause the currently playing music",
    owner: false,
    player: true,
    inVoiceChannel: true,
    djonly :true,
    sameVoiceChannel: true,
    wl : true,
	
    /**
     * 
     * @param {Client} client 
     * @param {CommandInteraction} interaction 
     */

    run: async (client, interaction) => {
        await interaction.deferReply({
          ephemeral: false
        });
          
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
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

        if (player.paused) {
            let thing = new EmbedBuilder()
    
                  .setColor(interaction.client?.embedColor || '#ff0051')
                .setDescription(`${no} The player is already paused.`)
                return interaction.editReply({embeds: [thing]});
        }

        await safePlayer.safeCall(player, 'pause', true);
    
        const song = tracks[0];

        let thing = new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${ok} **The player has been paused**`)
          return interaction.editReply({embeds: [thing]});
	
    }
};



