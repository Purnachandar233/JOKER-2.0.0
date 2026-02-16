const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const twentyfourseven = require("../../schema/twentyfourseven");
const autoplaySchema = require("../../schema/autoplay.js");

const EMOJIS = require("../../utils/emoji.json");
module.exports = {
    name: "autoplay",
    description: "Toggle music autoplay.",
    owner: false,
    player: true,
    inVoiceChannel: true,
    sameVoiceChannel: true,
    votelock: true,
    djonly :true,
    wl : true,

    /**
     * @param {Client} client
     * @param {CommandInteraction} interaction
     */

    run: async (client, interaction, prefix ) => {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({
            ephemeral: false
          });
        }

        let ok = EMOJIS.ok;
        let no = EMOJIS.no;

   //

   //
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
            const safePlayer = require('../../utils/safePlayer');
            const { getQueueArray } = require('../../utils/queue.js');
            let player = client.lavalink.players.get(interaction.guild.id);
            let tracks = getQueueArray(player);
            // If there is no active queue, allow enabling autoplay by using saved autoplay
            // metadata from the database or existing player metadata. Only reject when
            // there is no contextual data to derive an autoplay query/identifier.
      if(player && channel.id !== player.voiceChannelId) {
                                  const noperms = new EmbedBuilder()
             .setColor(interaction.client?.embedColor || '#ff0051')
          .setDescription(`${no} You must be connected to the same voice channel as me.`)
          return await interaction.editReply({embeds: [noperms]});
      }


      const autoplay = player ? player.get("autoplay") : false;
        if (autoplay === false) {
          // If no tracks available, try to load lastTrack from player, then DB
          let identifier = tracks && tracks[0] ? (tracks[0].identifier || tracks[0].info?.identifier) : null;
          let title = tracks && tracks[0] ? (tracks[0].info?.title || tracks[0].title) : '';
          let author = tracks && tracks[0] ? (tracks[0].info?.author || tracks[0].author) : '';

          // Try lastTrack from player metadata when queue is empty
          if ((!identifier && !title) && player && typeof player.get === 'function') {
            const last = player.get('lastTrack');
            if (last) {
              identifier = identifier || last.identifier || last.info?.identifier || null;
              title = title || last.info?.title || last.title || '';
              author = author || last.info?.author || last.author || '';
            }
          }

          // If still missing, try DB saved autoplay info
          if ((!identifier && !title) || !player) {
            const saved = await autoplaySchema.findOne({ guildID: interaction.guild.id });
            if (saved) {
              identifier = identifier || saved.identifier || null;
              // saved.query may already be title+author fallback
              if (!title && saved.query) {
                title = saved.query;
                author = '';
              }
            }
          }
          const query = (title ? `${title} ${author}`.trim() : null);

          // If still no identifier/query available, cannot enable autoplay
          if (!identifier && !query) {
            const noperms = new EmbedBuilder()
              .setColor(interaction.client?.embedColor || '#ff0051')
              .setDescription(`${no} There is nothing playing in this server.`)
            return await interaction.editReply({embeds: [noperms]});
          }

          // Ensure player exists (create if missing) so we can set metadata and queue
          if (!player) {
            player = await client.lavalink.createPlayer({
              guildId: interaction.guild.id,
              voiceChannelId: interaction.member.voice.channel.id,
              textChannelId: interaction.channel.id,
              selfDeafen: true,
            });
            if (player && player.node && !player.node.connected) await player.node.connect();
            tracks = getQueueArray(player);
          }

          player.set("autoplay", true);
          // store requester id for later rehydration in trackEnd
          player.set("requester", null);
          player.set("requesterId", interaction.member.id);
          player.set("identifier", identifier);
          player.set("autoplayQuery", query);

        // Save autoplay state to database (store requesterId and query)
        await autoplaySchema.findOneAndUpdate(
          { guildID: interaction.guild.id },
          {
            enabled: true,
            requesterId: interaction.member.id,
            identifier: identifier,
            query: query,
            lastUpdated: Date.now()
          },
          { upsert: true }
        );

        // Search non-YouTube sources using the built query.
        let res = null;
        if (query) {
          const sources = ['spotify', 'soundcloud', 'bandcamp', 'deezer', 'applemusic'];
          for (const source of sources) {
            try {
              const sp = player.search({ query, source }, interaction.member);
              const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('search timeout')), 8000));
              const r = await Promise.race([sp, timeout]).catch(() => null);
              if (r && r.tracks && r.tracks.length > 0) { res = r; break; }
            } catch (_) { continue; }
          }
        }

        if (!res || !res.tracks || res.tracks.length === 0) {
          let embed = new EmbedBuilder()
          .setDescription(`${no} Found nothing related for the latest song!`)
          .setColor(interaction.client?.embedColor || '#ff0051')
          try { client.channels.cache.get(player.textChannelId).send({embeds: [embed]}) } catch (e) { }
        } else {
          // Check if 24/7 is enabled
          const is247Enabled = await twentyfourseven.findOne({ guildID: interaction.guild.id });
          const safePlayer = require('../../utils/safePlayer');
          if (is247Enabled) {
            // With 24/7: Don't clear queue, just add to end
            safePlayer.queueAdd(player, res.tracks[0]);
          } else {
            // Without 24/7: Clear queue and add first track
            await safePlayer.queueClear(player);
            safePlayer.queueAdd(player, res.tracks[0]);
          }
        }

        let thing = new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${ok} Starting to play recommended tracks.`)
            return await interaction.editReply({embeds: [thing]});
    } else {
        player.set("autoplay", false);

        // Save autoplay state to database
        await autoplaySchema.findOneAndUpdate(
          { guildID: interaction.guild.id },
          {
            enabled: false,
            lastUpdated: Date.now()
          },
          { upsert: true }
        );

        // Check if 24/7 is enabled
        const is247Enabled = await twentyfourseven.findOne({ guildID: interaction.guild.id });

        if (!is247Enabled) {
          // Only clear queue if 24/7 is NOT enabled
          const safePlayer = require('../../utils/safePlayer');
          await safePlayer.queueClear(player);
        }
        // With 24/7 enabled, keep the queue for continuous play

        let thing = new EmbedBuilder()
        .setColor(interaction.client?.embedColor || '#ff0051')
            .setDescription(`${ok} I have stopped to play recommended tracks.`)

            return await interaction.editReply({embeds: [thing]});

    }


       }
     };

