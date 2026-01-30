const { EmbedBuilder } = require("discord.js");
const { truncate } = require("fs");

module.exports = {
    name: "bassboost",
    category: "Filters",
    description: "Enables/disables the bassboost filter.",
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

         .setColor(0xff0051)
           .setDescription(`${no} You must be connected to a voice channel to use this command.`)
        return await interaction.followUp({embeds: [noperms] , flags: [64]}).then(responce => {
          setTimeout(() => {
              try {
                  responce.delete().catch(() => {
                      return
                  })
              } catch(err) {
                  return
              }
          }, 12000)
      });;
    }
    if(interaction.member.voice.selfDeaf) {	
      let thing = new EmbedBuilder()
       .setColor(0xff0051)
     .setDescription(`${no} <@${interaction.member.id}> You cannot run this command while deafened.`)
       return await interaction.followUp({embeds: [thing], flags: [64]}).then(responce => {
        setTimeout(() => {
            try {
                responce.delete().catch(() => {
                    return
                })
            } catch(err) {
                return
            }
        }, 12000)
    });;
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
        return await interaction.followUp({embeds: [noperms], flags: [64]})
    }
        //
        if(!player.bassboost === true){
            player.bassboost = true;
       const noperms = new EmbedBuilder()
       .setColor(0xff0051)
       .setDescription(`${ok} Bassboost has been \`enabled\`. - <@!${interaction.member.id}>`)
       const noperms1 = new EmbedBuilder()
       .setColor(0xff0051)
             .setDescription(`${ok} Applying the \`bassboost\` Filter(*It might take up to 5 seconds until you hear the Filter*)`)
      return await interaction.followUp({embeds: [noperms1], ephemeral: false}),
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
           if(player.bassboost === true){
            player.bassboost = false;
      const noperms = new EmbedBuilder()
      .setColor(0xff0051)
      .setDescription(`${ok} Bassboost has been \`disabled\`. - <@!${interaction.member.id}>`)
      const noperms1 = new EmbedBuilder()
      .setColor(0xff0051)
            .setDescription(`${ok} Removing the \`bassboost\` Filter. (*It might take up to 5 seconds to remove the filter*)`)
      return await interaction.followUp({embeds: [noperms1], ephemeral: false}),
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


