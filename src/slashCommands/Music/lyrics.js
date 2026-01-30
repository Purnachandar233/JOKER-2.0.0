const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const db = require("quick.db")
const lyricsFinder = require("lyrics-finder");
const _ = require("lodash");
module.exports = {
  name: "lyrics",
  description: "Shows the lyrics of the song searched.",
  owner: false,
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  wl : true,
  options: [
    {
      name: "name",
      description: "Song Name",
      required: true,
      type: 3
		}
	],

  

  /**
   * @param {Client} client
   * @param {CommandInteraction} interaction
   */

  run: async (client, interaction,) => {
   await interaction.deferReply({
            ephemeral: false
        });
          
    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
        const song = interaction.options.getString("name");

    
        let pages = []
    
       
    
    
        let res = await lyricsFinder(song) 
        if(!res) {
            let no = new EmbedBuilder()
            .setDescription(`No results found.`)
              .setColor(0xff0051)
              return await interaction.followUp({ embeds : [no]})
        }
    
        for(let i = 0; i < res.length; i += 2048) {
            let lyrics = res.substring(i, Math.min(res.length, i + 2048))
            let page = new EmbedBuilder()
            .setDescription(lyrics)
            .setColor(0xff0051)
    
            pages.push(page)
            
            return await interaction.followUp({ embeds : [page]})
        
        }
  }
}