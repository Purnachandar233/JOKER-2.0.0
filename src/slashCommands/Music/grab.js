const { EmbedBuilder, Message } = require("discord.js");
const { createBar } = require('../../functions.js')

module.exports = {
	name: "grab",
    description: "grab a song to your dms",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    votelock : true,
    wl : true,
	
    /**
     * 
     * @param {Client} client 
     * @param {CommandInteraction} interaction 
     */

    run: async (client, interaction) => {
        await interaction.deferReply({
            flags: [64]
          });
            
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    

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

        const song = tracks[0]


      
  let embed = new EmbedBuilder()
  .setTitle("Now playing")
  .addFields([
    { name: 'Song', value: `[${song.info?.title || song.title}](https://discord.gg/pCj2UBbwST)` },
    { name: 'Song By', value: `[ ${song.info?.author || song.author} ]` },
    { name: 'Duration', value: `\` + (!song.isStream ? `${new Date(song.duration).toISOString().slice(11, 19)}` : '◉ LIVE') + `\`` },
    { name: `Queue length: `, value: `${tracks.length} Songs` },
    { name: `Progress: `, value: createBar(player) }
  ])
  .setColor(interaction.client?.embedColor || '#ff0051')
            
            interaction.member.send({embeds: [embed]}).catch(e=>{
            return interaction.editReply({ content : `Couldn't send you a dm 
            
            Possible reasons:
          - Your Dm's are disabled
          - You have me blocked
          None of these helped? Join our [**Support Server**](https://discord.gg/pCj2UBbwST) for more help.`})
          })  
          return interaction.editReply({ content : "**📪 Check your DM's.**" })
       
         
            
    }
};



