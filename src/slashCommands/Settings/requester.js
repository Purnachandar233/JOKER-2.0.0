const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");

module.exports = {
    name: "requester",
    description: "Enables/disables if the requester is shown on each track.",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    votelock: true,
    wl : true,
//
//
//

    /**
     * @param {Client} client
     * @param {CommandInteraction} interaction
     */

    run: async (client, interaction) => {
        await interaction.deferReply({
          ephemeral: false
        });
          
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
        if (!interaction.member.permissions.has('MANAGE_CHANNELS')) {
            const noperms = new EmbedBuilder()
           .setColor(interaction.client?.embedColor || '#ff0051')
           .setDescription(`You need this required Permissions: \`MANAGE_CHANNELS\` to run this command.`)
           return await interaction.followUp({embeds: [noperms]});
        }
        const Schema = require('../../schema/requesterSchema.js'); 

        let   data = await Schema.findOne({
            guildID: interaction.guild.id
        })
        if(data) {
          await  Schema.deleteMany({ guildID: interaction.guild.id });
        
            const embed = new EmbedBuilder()
            .setColor(interaction.client.embedColor)
             .setDescription(`${ok} Requester will be shown on each track.`)
             return await interaction.editReply({embeds: [embed]});
           
        }
        if(!data) {
          const savev =  await  Schema.create({
            guildID: interaction.guild.id,
            enabled: true,
          })
          
          savev.save();
    
            const embed = new EmbedBuilder()
            .setColor(interaction.client.embedColor)
             .setDescription(`${ok} Requester will now not be shown on each track.`)
             return await interaction.editReply({embeds: [embed]});
        }
           
       },
     };