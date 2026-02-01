const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");

module.exports = {
    name: "removedupes",
    description: "removes all duplicated tracks in the queue.",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    votelock: true,
    djonly :true,
    wl : true,

    /**
     * @param {Client} client
     * @param {CommandInteraction} interaction
     */

    run: async (client, interaction, prefix ) => {
        await interaction.deferReply({
          ephemeral: false
        });
   //  
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
		
      // build unique tracks preserving order
      const unique = [];
      const seen = new Set();
      for (const t of tracks) {
        const id = t?.info?.identifier || t?.identifier || t?.uri || t?.id || null;
        if (!id) continue;
        if (!seen.has(id)) {
          seen.add(id);
          unique.push(t);
        }
      }
      // clear the Queue and re-add unique tracks
      await require('../../utils/safePlayer').queueClear(player);
      require('../../utils/safePlayer').queueAdd(player, unique);
      //Send Success Message
       return await interaction.followUp({ embeds : [new EmbedBuilder().setDescription(`${ok} Removed all the duplicates songs from the queue.`)
      .setColor(interaction.client?.embedColor || '#ff0051')
]})
     
       }
     };




