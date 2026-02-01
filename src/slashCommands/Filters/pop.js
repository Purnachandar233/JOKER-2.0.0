const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "pop",
    category: "FILTERS",
    description: "Enables/disables the pop filter.",
    votelock: true,
    djonly : true,
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
    const { getQueueArray } = require('../../../utils/queue.js');
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
        //
        if(!player.pop === true){
            player.pop = true;
                     const noperms = new EmbedBuilder()
                .setColor(interaction.client?.embedColor || '#ff0051')
                     .setDescription(`${ok} Pop has been \`enabled\`. - <@!${interaction.member.id}>`)
                     const noperms1 = new EmbedBuilder()
                     .setColor(interaction.client?.embedColor || '#ff0051')
                           .setDescription(`${ok} Applying the \`pop\` Filter (*It might take up to 5 seconds until you hear the Filter*)`)
      return await interaction.followUp({embeds: [noperms1]}),
      interaction.channel.send({embeds: [noperms]}).then(responce => {
        setTimeout(() => {
            try {
                responce.delete().catch(() => {
                    return
                })
            } catch(err) {
                return
            }
        }, 30000)
    });;
        }
       if(player.pop === true){
            player.pop = false;
                    const noperms = new EmbedBuilder()
               .setColor(interaction.client?.embedColor || '#ff0051')
                    .setDescription(`${ok} Pop has been \`disabled\`. - <@!${interaction.member.id}>`)
                    const noperms1 = new EmbedBuilder()
                    .setColor(interaction.client?.embedColor || '#ff0051')
                          .setDescription(`${ok} Removing the \`pop\` Filter(*It might take up to 5 seconds to remove the filter.*)`)
      return await interaction.followUp({embeds: [noperms1]}),
      interaction.channel.send({embeds: [noperms]}).then(responce => {
        setTimeout(() => {
            try {
                responce.delete().catch(() => {
                    return
                })
            } catch(err) {
                return
            }
        }, 30000)
    });;
        }
        
     


    }
  }



