const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
const twentyfourseven = require("../../schema/twentyfourseven");
const autoplaySchema = require("../../schema/autoplay.js");

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
        await interaction.deferReply({
          ephemeral: false
        });
     
        let ok = client.emoji.ok;
        let no = client.emoji.no;
        
   //
   
   //
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

       .setDescription(`${no} <@${interaction.member.id}> You cannot run this command while deafened.`)
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
		
    
      const autoplay = player.get("autoplay");
        if (autoplay === false) {
          const identifier = tracks[0]?.identifier || tracks[0]?.info?.identifier || null;
          player.set("autoplay", true);
          player.set("requester", interaction.member.id);
          player.set("identifier", identifier);

        // Save autoplay state to database (store requesterId not full object)
        await autoplaySchema.findOneAndUpdate(
          { guildID: interaction.guild.id },
          {
            enabled: true,
            requesterId: interaction.member.id,
            identifier: identifier,
            lastUpdated: Date.now()
          },
          { upsert: true }
        );

        const search = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
        const res = await player.search(search, interaction.member);
        if (!res || res.loadType === 'LOAD_FAILED' || res.loadType !== 'PLAYLIST_LOADED') {
          let embed = new EmbedBuilder()
          .setDescription(`${no} Found nothing related for the latest song!`)
          .setColor(interaction.client?.embedColor || '#ff0051')
          try {
            client.channels.cache.get(player.textChannelId).send({embeds: [embed]})
          } catch (e) {  }
        }

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

