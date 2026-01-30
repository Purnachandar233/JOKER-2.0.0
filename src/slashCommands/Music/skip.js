const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");

module.exports = {
        name: "skip",
        description: "To skip a song/track from the queue.",
        owner: false,
        player: true,
        inVoiceChannel: true,
        sameVoiceChannel: true,
        wl : true,
    

    /**
     * 
     * @param {Client} client 
     * @param {CommandInteraction} interaction 
     * @param {String} color 
     */

  run: async (client, interaction) => {
    await interaction.deferReply({
            ephemeral: false
        });
        
          //  
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
    
     //
        const { channel } = interaction.member.voice;
        if (!channel) {
                        const noperms = new EmbedBuilder()
              
             .setColor(0xff0051)
               .setDescription(`${no} You must be connected to a voice channel to use this command.`)
            return await interaction.followUp({embeds: [noperms]});
        }
        if(interaction.member.voice.selfDeaf) { 
          let thing = new EmbedBuilder()
           .setColor(0xff0051)
    
         .setDescription(`${no} <@${interaction.user.id}> You cannot run this command while deafened.`)
           return await interaction.followUp({embeds: [thing]});
         }
                const player = client.lavalink.players.get(interaction.guild.id);
        if(!player || !player.queue.current) {
                        const noperms = new EmbedBuilder()
            
             .setColor(0xff0051)
             .setDescription(`${no} There is nothing playing in this server.`)
            return await interaction.followUp({embeds: [noperms]});
        }
        if(player && channel.id !== player.voiceChannelId) {
                                    const noperms = new EmbedBuilder()
              .setColor(0xff0051)
            .setDescription(`${no} You must be connected to the same voice channel as me.`)
            return await interaction.followUp({embeds: [noperms]});
        }

       

        player.stop();
  
        return await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0xff0051)            
            
              .setDescription(`${ok} Skipping to the next track.`)]
        }).catch(() => {});
  }
}
