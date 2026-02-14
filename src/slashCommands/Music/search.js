var {
    EmbedBuilder,
    ActionRowBuilder,
    MessageSelectMenu,
    createMessageComponentCollector
  } = require("discord.js")
  var {
    format,
    delay,
    arrayMove
  } = require("../../functions")
  const safePlayer = require('../../utils/safePlayer');
module.exports = {
  name: "search",
  description: "Searches a track from bandcamp.",
  owner: false,
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  wl : true,
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

  run: async (client, interaction) => {
   await interaction.deferReply({
            ephemeral: false
        });
  
        let ok = client.emoji.ok;
        let no = client.emoji.no;
        
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

try {
    var res;

    if (!player) {
      player = await client.lavalink.createPlayer({
        guildId: interaction.guild.id,
        voiceChannelId: interaction.member.voice.channel.id,
        textChannelId: interaction.channel.id,
        selfDeafen: true,
      });
      if (player && player.node && !player.node.connected) await player.node.connect()
    }
    let state = player.state;
    if (state !== "CONNECTED") {
      await safePlayer.safeCall(player, 'connect');
      await safePlayer.safeStop(player);
    }
    if(search.toLowerCase().includes("youtube.com")){
      const noperms = new EmbedBuilder()
      .setColor(interaction.client?.embedColor || '#ff0051')
      .setAuthor({ name: 'YouTube URL', iconURL: client.user.displayAvatarURL({ forceStatic: false }) })
      .setDescription(`We no longer support YouTube, please use other platforms like Spotify, SoundCloud or Bandcamp. Otherwise use a search query to use our default system.`)
      return await interaction.editReply({embeds: [noperms]});
    }
    if(search.toLowerCase().includes("youtu.be")){
      const noperms = new EmbedBuilder()
      .setColor(interaction.client?.embedColor || '#ff0051')
      .setAuthor({ name: 'YouTube URL', iconURL: client.user.displayAvatarURL({ forceStatic: false }) })
      .setDescription(`We no longer support YouTube, please use other platforms like Spotify, SoundCloud or Bandcamp. Otherwise use a search query to use our default system.`)
      return await interaction.editReply({embeds: [noperms]});
    }
    try {
      
      res = await player.search({
        query: search,
        source: 'soundcloud'
      }, interaction.member.user);

      if (res.loadType === "LOAD_FAILED") throw res.exception;
      else if (res.loadType === "PLAYLIST_LOADED") throw {
        message: `${ok} Playlists are not supported with this command. Use   ?playlist  `
      };
    } catch (e) {
      try { client.logger?.log(e.stack || e.toString(), 'error'); } catch (err) { console.log(e); }
       return await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('Error searching for track.')
          .setColor(interaction.client?.embedColor || '#ff0051')
        ]
      }).catch(() => {})
    }


    var max = 10;
    var collected;
    var cmduser = interaction.member.user;
    if (res.tracks.length < max) max = res.tracks.length;
    var track = res.tracks[0]
    var theresults = res.tracks
      .slice(0, max)
    var results = theresults.map((track, index) => `**${++index})** \`${String(track.title).slice(0, 60).split("[").join("{").split("]").join("}")}\` - \`${format(track.duration).split("")[0]}\``)
      .join('\n');
      if (!res.tracks[0]) {
        return await interaction.editReply({embeds : [new EmbedBuilder() 
          .setDescription(`${ok} No results found.`)
          .setColor(interaction.client?.embedColor || '#ff0051')]})
        }

    const emojiarray = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]
    first_layer()
    async function first_layer() {
      var songoptions = [...emojiarray.slice(0, max).map((emoji, index) => {
          return {
            value: `Add ${index + 1}. Track`.slice(0, 25),
            label: `${res.tracks[index].title}`.slice(0, 50),
            description: `Author: ${res.tracks[index].author} - Duration: ${format(res.tracks[index].duration)} `.slice(0, 80)
          }
        }),
        {
          value: `Cancel`,
          label: `Cancel`,
          description: `${ok} Cancel the Searching Process`,
        }
      ];
      let Selection = new MessageSelectMenu()
        .setCustomId('MenuSelection').setMaxValues(emojiarray.slice(0, max).length)
        .setPlaceholder('Select all Songs you want to add')
        .addOptions(songoptions)
      let menumsg;

        menumsg =  await interaction.editReply({
          embeds: [
            new EmbedBuilder()
           
            .setColor(interaction.client.embedColor)
            .setDescription(`
            Select the tracks you want to add to the queue.`)
      
          ],
          components: [
            new ActionRowBuilder().addComponents(Selection)
          ]
        }).catch(() => {});
      const message = interaction
      
      const collector = menumsg.createMessageComponentCollector({
        filter: i => i.isSelectMenu() && i.message.author.id == client.user.id && i.user,
        time: 90000
      });
      collector.on('collect', async menu => {
        try {
          if (menu.user.id !== cmduser.id) {
            await menu.reply({ content: `❌ You are not allowed to do that! Only: <@${cmduser.id}>`, flags: [64] });
            return;
          }

          collector.stop();
          await menu.deferUpdate();

          if (menu.values[0] === "Cancel") {
            try { await menumsg.delete(); } catch (e) {}
            return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(message.client.embedColor).setDescription(`${ok} Cancelled`)] });
          }

          const picked_songs = [];
          const toAddTracks = [];
          for (const value of menu.values) {
            const songIndex = songoptions.findIndex(d => d.value == value);
            const track = res.tracks[songIndex];
            toAddTracks.push(track);
            picked_songs.push(`${track.title}`);
          }

          await menumsg.edit({ embeds: [menumsg.embeds[0].setDescription('Queued:\n' + picked_songs.join('\n'))], components: [] });

          if (player.state !== "CONNECTED") {
            await safePlayer.safeCall(player, 'connect');
            safePlayer.queueAdd(player, toAddTracks);
            await safePlayer.safeCall(player, 'play');
            await safePlayer.safeCall(player, 'pause', false);
          } else {
            const tracksNow = require('../../utils/queue.js').getQueueArray(player);
            if (!tracksNow || tracksNow.length === 0) {
              safePlayer.queueAdd(player, toAddTracks);
              await safePlayer.safeCall(player, 'play');
              await safePlayer.safeCall(player, 'pause', false);
            } else {
              safePlayer.queueAdd(player, toAddTracks);
              const track = toAddTracks[0];
            }
          }
        } catch (err) {
          console.error('search.js collector error:', err && (err.message || err));
        }
      });

      collector.on('end', collected => {
        try {
          // Disable buttons on timeout
          const disabledRow = new ActionRowBuilder().addComponents(
            buttonList.map(btn => btn.setDisabled(true))
          );
          currentPage.edit({ components: [disabledRow] }).catch(() => {});
        } catch (e) {}
      });
    }


  } catch (e) {
      try { client.logger?.log(e.stack || e.toString(), 'error'); } catch (err) { console.log(e); }
       return await interaction.editReply({embeds : [new EmbedBuilder() 
    .setDescription(`No results found.`)
    .setColor(interaction.client?.embedColor || '#ff0051')]})
  }
   
  }
}

