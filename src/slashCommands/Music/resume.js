const { EmbedBuilder, CommandInteraction, Client } = require("discord.js")

module.exports = {
    name: "resume",
    description: "Resume currently playing music",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    wl : true,
    djonly :true,
	
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
                      
             .setColor(0xff0051)
               .setDescription(`${no} You must be connected to a voice channel to use this command.`)
            return await interaction.followUp({embeds: [noperms]});
        }
        if(interaction.member.voice.selfDeaf) {	
          let thing = new EmbedBuilder()
           .setColor(0xff0051)
         
         .setDescription(`${no} <@${interaction.member.id}> You cannot run this command while deafened.`)
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
     
        const song = player.queue.current;



        if (!player.paused) {
            let thing = new EmbedBuilder()
                  .setColor(0xff0051)

            .setDescription(`${no} The player is already resumed.`)
           return interaction.editReply({embeds: [thing]});
        }

        player.pause(false);
        let thing = new EmbedBuilder()

        .setDescription(`${ok} **The player has been resumed.**`)
            .setColor(0xff0051)
         return interaction.editReply({embeds: [thing]});
	
    }
};



