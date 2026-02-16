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
  category: "music",
  aliases: ["find", "searchsong"],
  description: "Search and select tracks to queue.",
  args: true,
  usage: "<song name>",
  wl: true,
  userPrams: [],
  botPrams: ["EMBED_LINKS"],
  owneronly: false,
  execute: async (message, args, client, prefix) => {
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

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const query = args.join(" ").trim();

    if (!query) {
      const embed = createEmbed({
        title: `${getEmoji("search")} Search Query Missing`,
        description: `${no} Usage: \`${prefix}search <song name>\``
      });
      return message.channel.send({ embeds: [embed] });
    }

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Voice Channel Required`,
        description: `${no} You must be connected to a voice channel to use this command.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    if (message.member?.voice?.selfDeaf) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Cannot Run While Deafened`,
        description: `${no} <@${message.member.id}> You cannot run this command while deafened.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    if (!client.lavalink) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Audio Backend Offline`,
        description: `${no} Lavalink is not connected yet. Please try again in a moment.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    let player = client.lavalink.players.get(message.guild.id);
    if (player && voiceChannel.id !== player.voiceChannelId) {
      const embed = createEmbed({
        title: `${getEmoji("error")} Wrong Voice Channel`,
        description: `${no} You must be connected to the same voice channel as me.`
      });
      return message.channel.send({ embeds: [embed] });
    }

    try {
      if (!player) {
        player = await client.lavalink.createPlayer({
          guildId: message.guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: message.channel.id,
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
        return message.channel.send({ embeds: [embed] });
      }

      let searchResult;
      try {
        searchResult = await player.search({ query, source: "soundcloud" }, message.member.user);
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
        return message.channel.send({ embeds: [embed] });
      }

      if (!searchResult?.tracks?.length) {
        const embed = createEmbed({
          title: `${getEmoji("search")} No Results`,
          description: `${ok} No tracks were found for that query.`
        });
        return message.channel.send({ embeds: [embed] });
      }

      const max = Math.min(10, searchResult.tracks.length);
      const menuId = `prefix_search_${message.id}`;

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
      const menuMsg = await message.channel.send({
        embeds: [promptEmbed],
        components: [row]
      });

      const collector = menuMsg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 90000,
        filter: i => i.customId === menuId
      });

      collector.on("collect", async menuInteraction => {
        if (menuInteraction.user.id !== message.author.id) {
          await menuInteraction.reply({
            content: `Only <@${message.author.id}> can use this menu.`,
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
          await menuMsg.edit({ components: [disabledRow] }).catch(() => {});
        } catch (err) {
          client.logger?.log?.(`Prefix search menu end handler error: ${err?.message || err}`, "warn");
        }
      });
    } catch (err) {
      client.logger?.log?.(err?.stack || err?.message || String(err), "error");
      const embed = createEmbed({
        title: `${getEmoji("error")} Search Error`,
        description: `${no} Something went wrong while processing search.`
      });
      return message.channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
};

