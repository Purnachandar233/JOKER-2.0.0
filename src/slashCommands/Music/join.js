const { EmbedBuilder, CommandInteraction, Client } = require("discord.js")
module.exports = {
  name: "join",
  
  description: "Join voice channel",
  owner: false,
  player: false,
  djonly :true,
  inVoiceChannel: true,
  sameVoiceChannel: true,
  wl : true,

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
     if(!player) {

         const player = client.lavalink.createPlayer({
             guildId: interaction.guild.id,
             voiceChannelId: channel.id,
             textChannelId: interaction.channel.id,
             selfDeafen: true,
         });

         const safePlayer = require('../../utils/safePlayer');
         await safePlayer.safeCall(player, 'connect');

         let thing = new EmbedBuilder()
             .setColor(interaction.client?.embedColor || '#ff0051')
                         .setDescription( `${ok} Connected to \`${channel.name}\``)
                         return await interaction.followUp({embeds: [thing]});

     } else if (interaction.guild.me.voice.channel !== channel) {

         let thing = new EmbedBuilder()
 
               .setColor(interaction.client?.embedColor || '#ff0051')
             .setDescription(`${no} You must be in the same channel as me.`);
             return await interaction.followUp({embeds: [thing]});
     }
     
     else if(player){
         const noperms = new EmbedBuilder()
   
         .setColor(interaction.client?.embedColor || '#ff0051')
         .setDescription(`${no} I am already connected to a voice channel.`)
         return await interaction.followUp({embeds: [noperms]});
     }

  }
};
