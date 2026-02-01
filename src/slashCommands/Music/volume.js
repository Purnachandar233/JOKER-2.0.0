const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const safePlayer = require('../../utils/safePlayer');

module.exports = {
    name: "volume",
    description: "Changes the volume of the currently playing track.",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    wl : true,
    options: [
      {
        name: "volume",
        description: "the new volume.",
        required: true,
        type: 10
                }
        ],
  votelock: true,

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
        
      const volume = interaction.options.getNumber("volume");
 
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

       .setDescription(`${no} <@${interaction.user.id}> You cannot run this command while deafened.`)
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
                
      if (volume < 0 || volume > 100) {
          let ething = new EmbedBuilder()
      
         .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} Please use a number between \`0\` - \`100\``)
          return await interaction.editReply({ embeds: [ething] });
      }
      await safePlayer.safeCall(player, 'setVolume', Number(volume));
  
    let thing = new EmbedBuilder()
      .setColor(interaction.client?.embedColor || '#ff0051')
      .setDescription(`${ok} The volume has been changed to **${volume}%**`)
    return await interaction.editReply({ embeds: [thing] });
     
       }
     };
