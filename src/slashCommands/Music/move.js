const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const {
    format,
    arrayMove
  } = require(`../../functions.js`);
const safePlayer = require('../../utils/safePlayer');
module.exports = {
    name: "move",
    description: "Change the position of a track in the queue.",
    owner: false,
    player: true,
    inVoiceChannel: true,
    djonly :true,
    sameVoiceChannel: true,
    djonly :true,
    wl : true,
    options: [
      {
        name: "from",
        description: "the position",
        required: true,
        type: 4
		},
        {
            name: "to",
            description: "the new position",
            required: true,
            type: 4
            },
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
    
      const from = interaction.options.getNumber("from");
      const to = interaction.options.getNumber("to");
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
		
      const qSize = safePlayer.queueSize(player);
      if (from <= 1 || from > qSize) {
        const eoer = new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription(`${no} Your input must be a number greater then \`1\` and smaller than \`${qSize}\``)
        return await interaction.editReply({embeds: [eoer]})
      }
        const arr = tracks;
        // convert 1-based positions to 0-based indices
        const fromIndex = Math.max(0, Math.min(arr.length - 1, from - 1));
        const toIndex = Math.max(0, Math.min(arr.length - 1, to - 1));
        const QueueArray = arrayMove(arr, fromIndex, toIndex);
        await safePlayer.queueClear(player);
        safePlayer.queueAdd(player, QueueArray);
    let thing = new EmbedBuilder()
      .setColor(interaction.client?.embedColor || '#ff0051')
      .setDescription(`${ok} Moved the track in the queue from position \`${from}\` to position \`${to}\``)    
      return await interaction.editReply({ embeds: [thing] });
     
       }
     };




