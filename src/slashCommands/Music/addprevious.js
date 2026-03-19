const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const EMOJIS = require("../../utils/emoji.json");
module.exports = {
  name: "addprevious",
  description: "Queues the previous track",
  owner: false,
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  votelock: true,
  djonly :true,
  wl : true,




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

      const emojiaddsong = EMOJIS.addsong;
      const emojiplaylist = EMOJIS.playlist;

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

    if (!player) player = client.lavalink.createPlayer({
      guildId: interaction.guildId,
      textChannelId: interaction.channelId,
      voiceChannelId: interaction.member.voice.channelId,
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

    const last = typeof player.get === 'function' ? player.get('lastTrack') : null;
    if (!last) {
        const noperms = new EmbedBuilder()
          .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`No previous songs found`)
        return await interaction.editReply({embeds: [noperms]});
    }

    const s = await player.search(last.uri, interaction.user);
    if (s.loadType === "LOAD_FAILED") {
      if (player && !player.queue?.current && !(Array.isArray(player.queue?.tracks) && player.queue.tracks.length > 0)) await player.destroy().catch(() => {});
      return await interaction.editReply({
        content: `${no} Error while Loading track.`
      }).catch(() => {});
    } else if (s.loadType === "NO_MATCHES") {
      if (player && !player.queue?.current && !(Array.isArray(player.queue?.tracks) && player.queue.tracks.length > 0)) await player.destroy().catch(() => {});
      return await interaction.editReply({
        content: `${no}No results found, try to be specific as possible.`
      }).catch(() => {});
    } else if (s.loadType === "TRACK_LOADED") {
      const shouldStart = !player.playing && !player.paused && !player.queue?.current && !(Array.isArray(player.queue?.tracks) && player.queue.tracks.length > 0);
      if (player) await player.queue.add(s.tracks[0]);
      if (shouldStart) await ensurePlaybackStarted();
      return await interaction.editReply({
        embeds: [new EmbedBuilder() .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`Queued ${s.tracks[0].title}`)]
      }).catch(() => {});
    } else if (s.loadType === "PLAYLIST_LOADED") {
      const shouldStart = !player.playing && !player.paused && !player.queue?.current && !(Array.isArray(player.queue?.tracks) && player.queue.tracks.length > 0);
      if (player) await player.queue.add(s.tracks);
      if (shouldStart) await ensurePlaybackStarted();

      return await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051')
        .setDescription(`Queued **${s.tracks.length}** tracks from **${s.playlist.name}**`)]
      }).catch(() => {} )
    } else if (s.loadType === "SEARCH_RESULT") {
      const shouldStart = !player.playing && !player.paused && !player.queue?.current && !(Array.isArray(player.queue?.tracks) && player.queue.tracks.length > 0);
      if (player) await player.queue.add(s.tracks[0]);
      if (shouldStart) await ensurePlaybackStarted();
      return await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`Queued ${s.tracks[0].title}`)]
      }).catch(() => {});
    } else return await interaction.editReply({
      content: `${no} No results found, try to be specific as possible.`
    }).catch(() => {});
  }
}
