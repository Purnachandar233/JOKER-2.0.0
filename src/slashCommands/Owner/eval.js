const { EmbedBuilder, CommandInteraction, Client, ActionRowBuilder, ButtonBuilder } = require("discord.js")
const { convertTime } = require('../../utils/convert.js');
const { inspect } = require('util')


module.exports = {
  name: "eval",
  description: "eval somthing",
  owner: false,
  player: true,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  wl : true,
  owneronly : true,
  options: [
    {
      name: "code",
      description: "the code you whould like to eval",
      required: true,
      type: 3
	  	}
	],

  /**
   * 
   * @param {Client} client 
   * @param {CommandInteraction} interaction 
   */

  run: async (client, interaction) => {
    const code = interaction.options.getString("code");
    await interaction.deferReply({
      ephemeral: false
    });
      
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
  
   
       const player = client.lavalink.players.get(interaction.guild.id);
       try {
        const drow = new ActionRowBuilder()
        .addComponents(
    new ButtonBuilder()
    .setLabel("Delete")
    .setStyle(4)
    .setCustomId("evaldelete"),
        );
       
        if(code.toLowerCase().includes("token","config")){
            interaction.editReply({ content: `\`\`\`js\nNIKAL BSDK\`\`\``, components: [drow]})
          }
          else{
         const result = await eval(code)
         let output = result; 
         if(typeof output !== 'string') {
           output = inspect(result)
         }
         
         if (output.length > 3990) {
    
    const sourcebin = require("sourcebin_js");
      await  sourcebin
          .create([
            {
              title: "JavaScript code",
              description: 'This code was created in "' + interaction.createdAt + '"',
              name: "Made By " + 'developers',
              content: output,
              languageId: "JavaScript"
            }
          ])
          .then(src => {

          
         return interaction.editReply({ content: `\`\`\`js\n${src.url}\`\`\``, components: [drow]});
          })
          return;
           
        
          
        } 
    
           const adrow = new ActionRowBuilder()
           .addComponents(
       new ButtonBuilder()
       .setLabel("Delete")
       .setStyle(4)
       .setCustomId("evaldelete"),
           );
        return interaction.editReply({ content: `\`\`\`js\n${result}\`\`\``, components: [adrow]});
           
          }
       } catch (error) {
                 
            const deletea = new ActionRowBuilder()
            .addComponents(
        new ButtonBuilder()
        .setLabel("Delete")
        .setStyle(4)
        .setCustomId("evaldelete"),
            );
         return interaction.editReply({ content: `\`\`\`js\n${error}\`\`\``, components: [deletea]});
        }
    }

  };
