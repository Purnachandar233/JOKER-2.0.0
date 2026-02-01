const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const { convertTime } = require('../../utils/convert.js')
const ms = require('ms');
const safePlayer = require('../../utils/safePlayer');

module.exports = {
    name: "replay",
    description: "restart the currently playing song",
    owner: false,
    player: true,
    djonly :true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    wl : true,


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


        await safePlayer.safeCall(player, 'seek', 0);
               
        const current = tracks[0];
        let thing = new EmbedBuilder()

          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${ok} Restarting [${current?.title || current?.info?.title || 'Track'}](https://www.youtube.com/watch?v=dQw4w9WgXcQ)`);
        return  await interaction.editReply({embeds: [thing]});

        
	
    }
};



