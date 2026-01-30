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

      const position = (Number(args[0]) - 1);
       if (position > player.queue.size) {
         const number = (position + 1);
         let thing = new EmbedBuilder()

           .setColor(0xff0051)
         .setDescription(`${no} No songs at number \`${number}\`. Total songs: \`${player.queue.size}\``);
          return await interaction.editReply({ embeds: [thing] });
       }
     
    const song = player.queue.at(position) || player.queue[position];
    player.queue.remove(position);

    const emojieject = client.emoji.remove;
  
    let thing = new EmbedBuilder()
      .setColor(0xff0051)

      .setDescription(`${ok} **Removed that song from Queue**`)
    return await interaction.editReply({ embeds: [thing] });
     
       }
     };



