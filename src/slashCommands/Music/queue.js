const { EmbedBuilder, CommandInteraction, Client, ButtonBuilder } = require("discord.js")
const { intpaginationEmbed } = require('../../utils/pagination.js');
const safePlayer = require('../../utils/safePlayer');
let chunk = require('chunk');
module.exports = {
  name: "queue",
  description: "Show the music queue and now playing.",
  owner: false,
  player: true,
  inVoiceChannel: false,
  wl : true,
  sameVoiceChannel: false,
 

  /**
   * 
   * @param {Client} client 
   * @param {CommandInteraction} interaction 
   */

  run: async (client, interaction) => {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    let ok = client.emoji.ok;
    let no = client.emoji.no;
    
    const { channel } = interaction.member.voice;
    if (!channel) {
                    const noperms = new EmbedBuilder()

         .setColor(interaction.client?.embedColor || '#ff0051')
           .setDescription(`${no} You must be connected to a voice channel to use this command.`)
        return await interaction.editReply({embeds: [noperms]});
    }
    if(interaction.member.voice.selfDeaf) { 	
      let thing = new EmbedBuilder()
       .setColor(interaction.client?.embedColor || '#ff0051')
     .setDescription(`${no} <@${interaction.member.id}> You cannot run this command while deafened.`)
       return await interaction.editReply({embeds: [thing]});
     }
        const player = client.lavalink.players.get(interaction.guild.id);
        const { getQueueArray } = require('../../utils/queue.js');
        const tracks = getQueueArray(player);
        if(!player || !tracks || tracks.length === 0) {
                    const noperms = new EmbedBuilder()

         .setColor(interaction.client?.embedColor || '#ff0051')
         .setDescription(`There is nothing playing in this server or there is no songs in the queue.`)
        return await interaction.editReply({embeds: [noperms]});
    }
    if(player && channel.id !== player.voiceChannelId) {
                  const noperms = new EmbedBuilder()
       .setColor(interaction.client?.embedColor || '#ff0051')
      .setDescription(`${no} You must be connected to the same voice channel as me.`)
      return await interaction.editReply({embeds: [noperms]});
    }
   //
   const dbtrack = require('../../schema/trackinfoSchema.js')
   let   data = await dbtrack.findOne({
     Soundcloudtracklink: tracks[0]?.uri,
 })
 if(data){
  const queue = tracks.map((track, i) => {
         return `${++i}. ${track.title}`


})
            const chunked = chunk(queue, 10);
            const embeds = [];
            for (let i = 1; i <= chunked.length; ++i)
                embeds.push(new EmbedBuilder().setColor((typeof client !== 'undefined' && client?.embedColor) ? client.embedColor : '#ff0051').setTitle(`${interaction.guild.name} Music Queue`).setDescription(`**Now playing**\n[${data.Spotifytracktitle}](${data.Spotifytracklink}) by [${data.Artistname}](${data.Artistlink})\n\n**Upcoming tracks**\n ${chunked[i - 1].join('\n')}`).setFooter({ text: `Page ${i}/${chunked.length}` }));
            const button1 = new ButtonBuilder().setCustomId('first').setLabel('First').setStyle(2);
            const button2 = new ButtonBuilder().setCustomId('back').setLabel('Back').setStyle(2);
            const button3 = new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(2);
            const button4 = new ButtonBuilder().setCustomId('last').setLabel('Last').setStyle(2);
            const buttonList = [button1, button2, button3, button4];
            intpaginationEmbed(interaction, embeds, buttonList, interaction.member.user, 30000);

   

    } else {
      const queue = tracks.map((track, i) => {
        const title = track?.info?.title || track?.title || 'Unknown Title';
        const duration = track?.info?.duration || track?.duration;
        const isStream = track?.info?.isStream || track?.isStream;
        const durationStr = isStream ? '◉ LIVE' : (duration ? new Date(duration).toISOString().slice(11, 19) : 'Unknown');
        return `${i + 1}. ${title} - \`${durationStr}\``;
      });

      const chunked = chunk(queue, 10);
      const embeds = [];
      for (let i = 1; i <= chunked.length; ++i) {
          const upcoming = chunked[i - 1] && chunked[i - 1].length ? chunked[i - 1].join('\n') : '*No more tracks in line.*';
          const current = tracks[0];
          const currentTitle = current?.info?.title || current?.title || 'No current track';
          const currentDuration = !current?.isStream ? (current?.duration ? new Date(current.duration).toISOString().slice(11, 19) : 'Unknown') : '◉ LIVE';
          embeds.push(new EmbedBuilder()
            .setColor(interaction.client?.embedColor || '#ff0051')
            .setTitle(`${interaction.guild.name} Music Queue`)
            .setDescription(`**Now playing**\n${currentTitle} -   \`${currentDuration}\`\n\n**Upcoming tracks**\n ${upcoming}`)
            .setFooter({ text: `Page ${i}/${chunked.length}` }));
      }
      const button1 = new ButtonBuilder().setCustomId('first').setLabel('First').setStyle(2);
      const button2 = new ButtonBuilder().setCustomId('back').setLabel('Back').setStyle(2);
      const button3 = new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(2);
      const button4 = new ButtonBuilder().setCustomId('last').setLabel('Last').setStyle(2);
      const buttonList = [button1, button2, button3, button4];
      intpaginationEmbed(interaction, embeds, buttonList, interaction.member.user, 30000);
    }
  }
  };



