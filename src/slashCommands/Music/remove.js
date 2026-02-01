const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");

module.exports = {
    name: "remove",
    description: "Remove song from the queue",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    djonly :true,
    wl : true,
    options: [
      {
        name: "number",
        description: "Number of the song in queue",
        required: true,
        type: 10
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
    
      const args = interaction.options.getNumber("number");
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

      const pos = Number(args);
       if (!Number.isFinite(pos) || pos < 1) {
         return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription(`${no} Invalid track number.`)] });
       }
      const safePlayer = require('../../utils/safePlayer');
      const arr = tracks;
      if (pos > arr.length) {
         return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription(`${no} No songs at number \`${pos}\`. Total songs: \`${arr.length}\``)] });
      }

    const song = arr[pos - 1];
    safePlayer.queueRemove(player, pos - 1);

    const emojieject = client.emoji.remove;
  
    let thing = new EmbedBuilder()
      .setColor(interaction.client?.embedColor || '#ff0051')

      .setDescription(`${ok} **Removed that song from Queue**`)
    return await interaction.editReply({ embeds: [thing] });
     
       }
     };



