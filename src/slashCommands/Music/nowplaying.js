const { EmbedBuilder, CommandInteraction, Client } = require("discord.js")

const { createBar } = require('../../functions.js')
module.exports = {
    name: "nowplaying",
    description: "Show now playing song",
    owner: false,
    player: true,
    inVoiceChannel: false,
    sameVoiceChannel: false,
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
        
         .setDescription(`${no} <@${interaction.user.id}> You cannot run this command while deafened.`)
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

        const song = player.queue.current
        const length = player.queue
        // Progress Bar
    //hello
        let embed = new EmbedBuilder()
        .setTitle("Now playing")
        .addFields(
            { name: 'Song', value: `[${song.info?.title || song.title}](https://discord.gg/pCj2UBbwST)`, inline: true },
            { name: 'Song By', value: `[ ${song.info?.author || song.author} ]`, inline: true },
            { name: 'Duration', value: `[ \`${!song.isStream ? `${new Date(song.duration).toISOString().slice(11, 19)}` : '◉ LIVE'}\` ]`, inline: true },
            { name: `Queue length: `, value: `${player.queue.size} Songs`, inline: true },
            { name: `⏳ Progress: `, value: createBar(player) }
        )
        .setColor(0xff0051)
         return interaction.editReply({embeds: [embed]})

            
    }
};

