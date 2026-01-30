const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const {
    format,
    arrayMove
  } = require(`../../functions.js`);
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
		
      if (from <= 1 || from > player.queue.size) {
        const eoer = new EmbedBuilder()
        .setColor(0xff0051)
        .setDescription(`${no} Your input must be a number greater then \`1\` and smaller than \`${player.queue.size}\``)
        return await interaction.editReply({embeds: [eoer]})
      }
      let song = player.queue[player.queue.size - 1];
        let QueueArray = arrayMove(player.queue, player.queue.size - 1, 0);
        while (player.queue.size > 0) { player.queue.remove(0); };
        for (const track of QueueArray)
          player.queue.add(track);
    let thing = new EmbedBuilder()
      .setColor(0xff0051)
      .setDescription(`${ok} Moved the track in the queue from position \`${from}\` to position \`${to}\``)    
      return await interaction.editReply({ embeds: [thing] });
     
       }
     };




