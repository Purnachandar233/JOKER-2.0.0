const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const EMOJIS = require("../../utils/emoji.json");
var {
    arrayMove
  } = require("../../functions.js")
const safePlayer = require('../../utils/safePlayer')
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

        let ok = EMOJIS.ok;
        let no = EMOJIS.no;

    const search = interaction.options.getString("query");

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

    let player = client.lavalink.players.get(interaction.guildId);
    if(player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
.setDescription(`${no} You must be connected to the same voice channel as me.`)
return await interaction.editReply({embeds: [noperms]});
}
 await interaction.editReply({embeds : [new EmbedBuilder()
    .setColor(interaction.client?.embedColor || '#ff0051')
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
      await safePlayer.safeCall(player, 'connect');
      await safePlayer.safeStop(player);
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
      try { client.logger?.log(e.stack || e.toString(), 'error'); } catch (err) { console.log(e); }

    }
    if (!res.tracks[0])
    return await interaction.editReply({embeds : [new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
      .setDescription(`${no} No results found.`)]})

    if (state !== "CONNECTED") {
      player.set("message", interaction);
      player.set("playerauthor", interaction.member.id);
      await safePlayer.safeCall(player, 'connect');
      safePlayer.queueAdd(player, res.tracks[0]);
      await safePlayer.safeCall(player, 'play');
      await safePlayer.safeCall(player, 'pause', false);
    }
    else {
      const { getQueueArray } = require('../../utils/queue.js');
      const tracks = getQueueArray(player);
      if(!player || !tracks || tracks.length === 0){
        safePlayer.queueAdd(player, res.tracks[0]);
        await safePlayer.safeCall(player, 'play');
        await safePlayer.safeCall(player, 'pause', false);
      } else {
        safePlayer.queueAdd(player, res.tracks[0]);

        const arr = tracks;
        const QueueArray = arrayMove(arr, arr.length - 1, 0);

        await safePlayer.queueClear(player);
        safePlayer.queueAdd(player, QueueArray);

        // use stop to reliably advance playback
        await safePlayer.safeStop(player);

        return;
      }
    }
  } catch (e) {
    try { client.logger?.log(e.stack || e.toString(), 'error'); } catch (err) { console.log(e); }
    return await interaction.editReply({embeds : [new EmbedBuilder()
      .setColor(interaction.client?.embedColor || '#ff0051')

    .setDescription(`${no} No results found.`)]})
  }

  }
}

