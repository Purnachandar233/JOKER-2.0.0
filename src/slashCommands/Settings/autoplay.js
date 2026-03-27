const { CommandInteraction, Client, EmbedBuilder } = require("discord.js");
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
        const embedColor = interaction.client?.embedColor || '#ff0051';

        const { channel } = interaction.member.voice;
        if (!channel) {
          const noperms = new EmbedBuilder()
            .setColor(embedColor)
            .setDescription(`${no} You must be connected to a voice channel to use this command.`);
          return await interaction.editReply({ embeds: [noperms] });
        }

        if (interaction.member.voice.selfDeaf) {
          const thing = new EmbedBuilder()
            .setColor(embedColor)
            .setDescription(`${no} <@${interaction.member.id}> You cannot run this command while deafened.`);
          return await interaction.editReply({ embeds: [thing] });
        }

        const player = client.lavalink.players.get(interaction.guild.id);
        if (player && channel.id !== player.voiceChannelId) {
          const noperms = new EmbedBuilder()
            .setColor(embedColor)
            .setDescription(`${no} You must be connected to the same voice channel as me.`);
          return await interaction.editReply({ embeds: [noperms] });
        }

        const savedAutoplay = await autoplaySchema.findOne({ guildID: interaction.guild.id }).lean().catch(() => null);
        const tracks = [
          player?.queue?.current,
          ...(Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [])
        ].filter(Boolean);
        const lastTrack = player && typeof player.get === 'function' ? player.get('lastTrack') : null;
        const seedTrack = tracks[0] || lastTrack || null;
        const identifier =
          seedTrack?.identifier ||
          seedTrack?.info?.identifier ||
          savedAutoplay?.identifier ||
          null;
        const title = seedTrack?.info?.title || seedTrack?.title || '';
        const author = seedTrack?.info?.author || seedTrack?.author || '';
        const query = (title ? `${title} ${author}`.trim() : '') || savedAutoplay?.query || null;
        const autoplayEnabled = (player?.get?.("autoplay") === true) || Boolean(savedAutoplay?.enabled);

        if (!autoplayEnabled) {
          if (!identifier && !query) {
            const noperms = new EmbedBuilder()
              .setColor(embedColor)
              .setDescription(`${no} There is nothing playing in this server.`);
            return await interaction.editReply({ embeds: [noperms] });
          }

          if (player && typeof player.set === "function") {
            player.set("autoplay", true);
            player.set("requester", null);
            player.set("requesterId", interaction.member.id);
            player.set("identifier", identifier);
            player.set("autoplayQuery", query);
          }

          await autoplaySchema.findOneAndUpdate(
            { guildID: interaction.guild.id },
            {
              enabled: true,
              requesterId: interaction.member.id,
              identifier,
              query,
              lastUpdated: Date.now()
            },
            { upsert: true, setDefaultsOnInsert: true }
          );

          const thing = new EmbedBuilder()
            .setColor(embedColor)
            .setDescription(`${ok} Autoplay is now enabled. Recommended tracks will continue after the queue ends.`);
          return await interaction.editReply({ embeds: [thing] });
        }

        if (player && typeof player.set === "function") {
          player.set("autoplay", false);
        }

        await autoplaySchema.findOneAndUpdate(
          { guildID: interaction.guild.id },
          {
            enabled: false,
            lastUpdated: Date.now()
          },
          { upsert: true, setDefaultsOnInsert: true }
        );

        const thing = new EmbedBuilder()
          .setColor(embedColor)
          .setDescription(`${ok} Autoplay is now disabled.`);
        return await interaction.editReply({ embeds: [thing] });
       }
     };
