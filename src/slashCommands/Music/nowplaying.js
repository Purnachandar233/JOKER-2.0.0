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
  
             .setColor(interaction.client?.embedColor || '#ff0051')
               .setDescription(`${no} You must be connected to a voice channel to use this command.`)
            return await interaction.followUp({embeds: [noperms]});
        }
        if(interaction.member.voice.selfDeaf) { 
          let thing = new EmbedBuilder()
           .setColor(interaction.client?.embedColor || '#ff0051')
        
         .setDescription(`${no} <@${interaction.user.id}> You cannot run this command while deafened.`)
           return await interaction.followUp({embeds: [thing]});
         }
        const safePlayer = require('../../utils/safePlayer');
        const { getQueueArray } = require('../../utils/queue.js');
        const player = client.lavalink.players.get(interaction.guild.id);
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

        const song = tracks[0];
        const title = song?.info?.title || song?.title || 'Unknown Title';
        const author = song?.info?.author || song?.author || 'Unknown';
        const isStream = song?.info?.isStream || song?.isStream || false;
        const duration = song?.info?.duration || song?.duration || null;
        const durationStr = isStream ? '◉ LIVE' : (duration ? new Date(duration).toISOString().slice(11, 19) : 'Unknown');

        let embed = new EmbedBuilder()
        .setTitle("Now playing")
        .addFields(
          { name: 'Song', value: `[${title}](https://discord.gg/pCj2UBbwST)`, inline: true },
          { name: 'Song By', value: `[ ${author} ]`, inline: true },
          { name: 'Duration', value: `[ \`${durationStr}\` ]`, inline: true },
          { name: `Queue length: `, value: `${safePlayer.queueSize(player)} Songs`, inline: true },
          { name: `⏳ Progress: `, value: createBar(player) }
        )
        .setColor(interaction.client?.embedColor || '#ff0051')
         return interaction.editReply({embeds: [embed]})

            
    }
};

