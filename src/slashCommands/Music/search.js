const { ActionRowBuilder, ComponentType, EmbedBuilder, StringSelectMenuBuilder } = require("discord.js");

const safePlayer = require("../../utils/safePlayer");
const { getQueueArray } = require("../../utils/queue");
const { convertTime } = require("../../utils/convert.js");

const EMOJIS = require("../../utils/emoji.json");
function getTrackTitle(track) {
  return track?.info?.title || track?.title || "Unknown Title";
}

function getTrackAuthor(track) {
  return track?.info?.author || track?.author || track?.pluginInfo?.author || "Unknown";
}

function getTrackDuration(track) {
  const duration = track?.info?.duration ?? track?.duration ?? track?.info?.length ?? 0;
  return Number.isFinite(duration) ? duration : 0;
}

function isTrackLive(track) {
  return Boolean(track?.info?.isStream || track?.isStream);
}

module.exports = {
  name: "search",
  description: "Search and select tracks to queue.",
  owner: false,
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  wl: true,
  options: [
    {
      name: "query",
      description: "Song / URL",
      required: true,
      type: 3
    }
  ],

  run: async (client, interaction) => {
    const getEmoji = (key, fallback = "") => EMOJIS[key] || fallback;
    const embedColor = client?.embedColor || "#ff0051";
    const createEmbed = ({ title, description, fields, author, thumbnail, image, footer, timestamp = false }) => {
      const embed = new EmbedBuilder().setColor(embedColor);
      if (title) embed.setTitle(title);
      if (description) embed.setDescription(description);
      if (Array.isArray(fields) && fields.length > 0) embed.addFields(fields);
      if (author) embed.setAuthor(author);
      if (thumbnail) embed.setThumbnail(thumbnail);
      if (image) embed.setImage(image);
return embed;
    };

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Voice Channel Required`,
        description: `${no} You must be connected to a voice channel to use this command.`
      });
      return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.member?.voice?.selfDeaf) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Cannot Run While Deafened`,
        description: `${no} <@${interaction.member.id}> You cannot run this command while deafened.`
      });
      return interaction.editReply({ embeds: [embed] });
    }

    let player = client.lavalink.players.get(interaction.guildId);
    if (player && voiceChannel.id !== player.voiceChannelId) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Wrong Voice Channel`,
        description: `${no} You must be connected to the same voice channel as me.`
      });
      return interaction.editReply({ embeds: [embed] });
    }

    try {
      if (!player) {
        player = await client.lavalink.createPlayer({
          guildId: interaction.guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: interaction.channel.id,
          selfDeafen: true
        });
      }

      if (player.state !== "CONNECTED") {
        await safePlayer.safeCall(player, "connect");
      }

      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes("youtube.com") || lowerQuery.includes("youtu.be")) {
        const embed = createEmbed({
          title: `${getEmoji("error")} Unsupported URL`,
          description: "YouTube links are not supported here. Use Spotify, SoundCloud, Bandcamp, or plain search text."
        });
        return interaction.editReply({ embeds: [embed] });
      }

      let searchResult;
      try {
        searchResult = await player.search({ query, source: "soundcloud" }, interaction.member.user);
        if (searchResult.loadType === "LOAD_FAILED") throw searchResult.exception;
        if (searchResult.loadType === "PLAYLIST_LOADED") {
          throw new Error("Playlists are not supported with this command.");
        }
      } catch (err) {
        client.logger?.log?.(err?.stack || err?.message || String(err), "error");
        const embed = createEmbed({
          title: `${getEmoji("error")} Search Failed`,
          description: "I could not fetch results for this query. Try another keyword."
        });
        return interaction.editReply({ embeds: [embed] });
      }

      if (!searchResult?.tracks?.length) {
        const embed = createEmbed({
          title: `${getEmoji("search")} No Results`,
          description: `${ok} No tracks were found for that query.`
        });
        return interaction.editReply({ embeds: [embed] });
      }

      const max = Math.min(10, searchResult.tracks.length);
      const menuId = `music_search_menu_${interaction.id}`;

      const options = searchResult.tracks.slice(0, max).map((track, index) => {
        const title = getTrackTitle(track);
        const author = getTrackAuthor(track);
        const durationText = isTrackLive(track) ? "LIVE" : convertTime(getTrackDuration(track));

        return {
          value: String(index),
          label: String(title).slice(0, 100),
          description: `${author} | ${durationText}`.slice(0, 100)
        };
      });

      options.push({
        value: "cancel",
        label: "Cancel",
        description: "Close this search panel"
      });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(menuId)
        .setPlaceholder("Select tracks to queue")
        .setMinValues(1)
        .setMaxValues(max)
        .addOptions(options);

      const promptEmbed = createEmbed({
        title: `${getEmoji("search")} Search Results`,
        description: "Select one or more tracks from the menu below to queue them.",
        footer: `${getEmoji("time")} Panel expires in 90 seconds`
      });

      const row = new ActionRowBuilder().addComponents(menu);
      const replyMessage = await interaction.editReply({
        embeds: [promptEmbed],
        components: [row]
      });

      const collector = replyMessage.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 90000,
        filter: i => i.customId === menuId
      });

      collector.on("collect", async menuInteraction => {
        if (menuInteraction.user.id !== interaction.user.id) {
          await menuInteraction.reply({
            content: `Only <@${interaction.user.id}> can use this menu.`,
            ephemeral: true
          }).catch(() => {});
          return;
        }

        if (menuInteraction.values.includes("cancel")) {
          await menuInteraction.update({
            embeds: [
              createEmbed({
                title: `${getEmoji("info")} Search Cancelled`,
                description: `${ok} Search panel closed.`
              })
            ],
            components: []
          }).catch(() => {});
          collector.stop("cancelled");
          return;
        }

        const selectedTracks = menuInteraction.values
          .map(value => searchResult.tracks[Number(value)])
          .filter(Boolean);

        if (!selectedTracks.length) {
          await menuInteraction.reply({ content: "No valid tracks selected.", ephemeral: true }).catch(() => {});
          return;
        }

        if (player.state !== "CONNECTED") {
          await safePlayer.safeCall(player, "connect");
        }

        const queueBefore = getQueueArray(player) || [];
        safePlayer.queueAdd(player, selectedTracks);

        if (queueBefore.length === 0) {
          await safePlayer.safeCall(player, "play");
          await safePlayer.safeCall(player, "pause", false);
        }

        const pickedSongs = selectedTracks.map((track, idx) => `${idx + 1}. ${String(getTrackTitle(track)).slice(0, 80)}`);
        await menuInteraction.update({
          embeds: [
            createEmbed({
              title: `${getEmoji("queue")} Added To Queue`,
              description: `${ok} Queued **${selectedTracks.length}** track(s).\n\n${pickedSongs.join("\n")}`
            })
          ],
          components: []
        }).catch(() => {});

        collector.stop("selected");
      });

      collector.on("end", async (_collected, reason) => {
        if (reason !== "time") return;
        try {
          const disabledMenu = StringSelectMenuBuilder.from(menu).setDisabled(true);
          const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
          await interaction.editReply({ components: [disabledRow] }).catch(() => {});
        } catch (err) {
          client.logger?.log?.(`Search menu end handler error: ${err?.message || err}`, "warn");
        }
      });
    } catch (err) {
      client.logger?.log?.(err?.stack || err?.message || String(err), "error");
      const embed = createEmbed({
        title: `${getEmoji("error")} Search Error`,
        description: `${no} Something went wrong while processing search.`
      });
      return interaction.editReply({ embeds: [embed] }).catch(() => {});
    }
  }
};

