const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");

module.exports = {
    name: "defaultvolume",
    description: "Change the default volume of all songs.",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    votelock : true,
    wl : true,
    options: [
      {
        name: "volume",
        description: "the new volume.",
        required: true,
        type: 4
		}
	],
    votelock: true,

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
    
        if (!interaction.member.permissions.has('MANAGE_CHANNELS')) {
            const noperms = new EmbedBuilder()
           .setColor(0xff0051)
           .setDescription(`You need this required Permissions: \`MANAGE_CHANNELS\` to run this command.`)
           return await interaction.followUp({embeds: [noperms]});
        }
      const volume = interaction.options.getNumber("volume");
      if(volume > 150 ) {
        let thing = new EmbedBuilder()
                     .setColor(0xff0051)
                   .setDescription(`${no} You cannot set the default volume over \`150\``);
                   return await interaction.followUp({embeds: [thing]});
   }
     


   const Schema = require('../../schema/defaultvolumeSchema');
let data;
try {
    data = await Schema.findOne({
        guildID: interaction.guild.id
    })
    if(!data) {
        let newData = await Schema.create({
            guildID: interaction.guild.id,
            Volume: volume,
        })
        newData.save();
    } else {
        await Schema.findOneAndUpdate({
            guildID: interaction.guild.id,
            Volume: volume,
        })
    }
} catch(err) {
    console.log(err)
}

			 let thing = new EmbedBuilder()
             .setColor(interaction.client.embedColor)
                .setDescription(`${ok} Updated the default volume to **${volume}%**.`);
                return await interaction.editReply({embeds: [thing]});
       }
     };