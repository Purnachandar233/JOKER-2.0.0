const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const EMOJIS = require("../../utils/emoji.json");
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
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitForVoiceBridge = async () => {
      const startedAt = Date.now();
      while ((Date.now() - startedAt) < 10000) {
        const botChannelId = interaction.guild.members.me?.voice?.channelId || null;
        const hasVoiceBridge = Boolean(
          player?.voice?.sessionId &&
          player?.voice?.token &&
          player?.voice?.endpoint
        );

        if (botChannelId === channel.id && hasVoiceBridge) {
          return true;
        }

        await sleep(200);
      }

      return false;
    };
    const ensurePlaybackStarted = async () => {
      if (player.state !== "CONNECTED" || interaction.guild.members.me?.voice?.channelId !== channel.id) {
        await player.connect();
      }

      const voiceReady = await waitForVoiceBridge();
      if (!voiceReady) return false;

      await player.play({ paused: false });
      return true;
    };
    try {
      res = await player.search({
        query: search,
      }, interaction.member);
    } catch (e) {
      try { client.logger?.log(e.stack || e.toString(), 'error'); } catch (err) { console.log(e); }
      return await interaction.editReply({embeds : [new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription(`${no} Failed to load that query right now.`)]});
    }

    if (res?.loadType === "LOAD_FAILED") {
      return await interaction.editReply({embeds : [new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription(`${no} ${res?.exception?.message || "Failed to load track."}`)]});
    }

    if (res?.loadType === "PLAYLIST_LOADED") {
      return await interaction.editReply({embeds : [new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription(`${no} Playlists are not supported with this command.`)]});
    }

    if (!res?.tracks?.[0])
    return await interaction.editReply({embeds : [new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
      .setDescription(`${no} No results found.`)]})

    const hasActiveTrack = Boolean(player.queue?.current) || player.playing || player.paused;
    const hasQueuedTracks = Array.isArray(player.queue?.tracks) && player.queue.tracks.length > 0;
    const trackTitle = res.tracks[0]?.info?.title || res.tracks[0]?.title || 'Track';

    if (!hasActiveTrack && !hasQueuedTracks) {
      await player.queue.add(res.tracks[0]);
      const started = await ensurePlaybackStarted();
      if (!started) throw new Error('Failed to start playback');
      return await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${ok} Now playing **${trackTitle}**`)]
      });
    }
    else {
      await player.queue.add(res.tracks[0], 0);
      await player.skip();
      return await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${ok} Skipping to **${trackTitle}** next.`)]
      });
    }
  } catch (e) {
    try { client.logger?.log(e.stack || e.toString(), 'error'); } catch (err) { console.log(e); }
    return await interaction.editReply({embeds : [new EmbedBuilder()
      .setColor(interaction.client?.embedColor || '#ff0051')

    .setDescription(`${no} No results found.`)]})
  }

  }
}
