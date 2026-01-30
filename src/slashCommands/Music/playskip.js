const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
var {
    arrayMove
  } = require("../../functions.js")
const db = require("quick.db")
module.exports = {
  name: "playskip",
  description: "Play skips a track.",
  owner: false,
  player: false,
  inVoiceChannel: true,
  wl : true,
  sameVoiceChannel: false,
  options: [
    {
      name: "query",
      description: "Song / URL",
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
        
    const search = interaction.options.getString("query");
 
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

       .setDescription(`${no} <@${interaction.member.id}> You cannot run this command while deafened.`)
         return await interaction.followUp({embeds: [thing]});
       }

    let player = client.lavalink.players.get(interaction.guildId);
    if(player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder()
          .setColor(0xff0051)
.setDescription(`${no} You must be connected to the same voice channel as me.`)
return await interaction.followUp({embeds: [noperms]});
}
 await interaction.editReply({embeds : [new EmbedBuilder()
    .setColor(0xff0051)
    .setDescription(`Searching: \`${search}\``)]})
try {
    var res;
    if(!player)
      player = client.lavalink.createPlayer({
        guildId: interaction.guild.id,
        voiceChannelId: interaction.member.voice.channel.id,
        textChannelId: interaction.channel.id,
        selfDeafen: true,
      });
    let state = player.state;
    if (state !== "CONNECTED") { 
      player.set("message", interaction);
      player.set("playerauthor", interaction.member.id);
      player.connect();
      player.stop();
    }
    try {
     
        res = await player.search({
          query: search,
        }, interaction.member);

 
      if (res.loadType === "LOAD_FAILED") throw res.exception;
      else if (res.loadType === "PLAYLIST_LOADED") throw {
        message: "${no} Playlists are not supported with this command."
      };
    } catch (e) {
      console.log(e)

    }
    if (!res.tracks[0])
    return await interaction.editReply({embeds : [new EmbedBuilder()
        .setColor(0xff0051)
      .setDescription(`${no} No results found.`)]})

    if (state !== "CONNECTED") {
    
      player.set("message", interaction);
      player.set("playerauthor", interaction.member.id);
      player.connect();
     
      player.queue.add(res.tracks[0]);
      player.play();
      player.pause(false);
 
    }
    else if(!player.queue || !player.queue.current){
      
      player.queue.add(res.tracks[0]);
      player.play();
      player.pause(false);
     
    }
    else {
      player.queue.add(res.tracks[0]);
      player.queue[player.queue.size - 1];

    var QueueArray = arrayMove(player.queue, player.queue.size - 1, 0);

      while (player.queue.size > 0) { player.queue.remove(0); };

      for (var track of QueueArray)
        player.queue.add(track);

      player.stop();


      return;
    }
  } catch (e) {
    console.log(e)
    return await interaction.editReply({embeds : [new EmbedBuilder()
      .setColor(0xff0051)

    .setDescription(`${no} No results found.`)]})
  }
   
  }
}



