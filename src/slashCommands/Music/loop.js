const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const { convertHmsToMs } = require("../../utils/convert");

module.exports = {
    name: "loop",
    description: "Toggle looping",
    type: 1,
    wl : true,
    options: [
        {
            name: "mode",
            description: "The loop mode",
            type: 3,
            required: true,
            choices: [
                {
                    name: "track",
                    value: "track"
                },
                {
                    name: "queue",
                    value: "queue"
                },
                {
                    name: "disabled",
                    value: "disabled"
                },
            ],
        },
    ],
    djonly :true,
        

    /**
     * @param {Client} client
     * @param {CommandInteraction} interaction
     */

    run: async (client, interaction ) => {
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
		
      const chosenString = interaction.options.getString("mode")
if(chosenString === 'track'){
    player.setRepeatMode(player.repeatMode === 'track' ? 'off' : 'track');
    const trackRepeat = player.repeatMode === 'track' ? "enabled" : "disabled";
    let thing = new EmbedBuilder()
    .setColor(interaction.client.embedColor)
    .setDescription(`${ok} Looping the track is now \`${trackRepeat}\``)
    return await interaction.followUp({embeds: [thing]});

}
if(chosenString === 'queue'){
    player.setRepeatMode(player.repeatMode === 'queue' ? 'off' : 'queue');
    const queueRepeat = player.repeatMode === 'queue' ? "enabled" : "disabled";
    let thing = new EmbedBuilder()
    .setColor(interaction.client.embedColor)
    .setDescription(`${ok} Looping the queue is now \`${queueRepeat}\``)
    return await interaction.followUp({embeds: [thing]});

}
if(chosenString === 'disabled'){
    player.setRepeatMode('off');
    let thing = new EmbedBuilder()
    .setColor(interaction.client.embedColor)
    .setDescription(`${ok} Disabled all looping options.`)
    return await interaction.followUp({embeds: [thing]});

}
       }
     };



