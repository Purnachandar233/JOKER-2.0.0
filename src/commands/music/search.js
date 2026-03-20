const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  SectionBuilder,
  TextDisplayBuilder,
} = require("discord.js");

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

const SEARCH_SOURCE_ORDER = ["spotify", "soundcloud", "applemusic", "deezer", "bandcamp"];
const SEARCH_PANEL_PAGE_SIZE = 5;

function normalizeSourceName(source) {
  const value = String(source || "").trim().toLowerCase();
  if (!value) return null;

  if (["spotify", "spsearch", "sp"].includes(value)) return "spotify";
  if (["soundcloud", "scsearch", "sc"].includes(value)) return "soundcloud";
  if (["applemusic", "apple", "apple music", "amsearch", "am"].includes(value)) return "applemusic";
  if (["deezer", "dzsearch", "dz", "dzisrc"].includes(value)) return "deezer";
  if (["bandcamp", "bcsearch", "bc"].includes(value)) return "bandcamp";

  return value;
}

function uniqueSources(list) {
  return [...new Set((Array.isArray(list) ? list : [list]).map(normalizeSourceName).filter(Boolean))];
}

function getAvailableSearchSources(client, player, preferredSources = SEARCH_SOURCE_ORDER) {
  const preferred = uniqueSources(preferredSources);
  const nodes = [];

  if (player?.node) nodes.push(player.node);

  for (const node of Array.from(client?.lavalink?.nodeManager?.nodes?.values?.() || [])) {
    if (!nodes.includes(node)) nodes.push(node);
  }

  const advertisedSources = new Set();
  let hasNodeInfo = false;

  for (const node of nodes) {
    if (!Array.isArray(node?.info?.sourceManagers)) continue;
    hasNodeInfo = true;

    for (const source of node.info.sourceManagers) {
      const normalized = normalizeSourceName(source);
      if (normalized) advertisedSources.add(normalized);
    }
  }

  return {
    sources: hasNodeInfo ? preferred.filter((source) => advertisedSources.has(source)) : preferred,
    advertisedSources: [...advertisedSources],
    hasNodeInfo,
  };
}

function formatSourceList(sources) {
  return Array.isArray(sources) && sources.length ? sources.join(", ") : "none";
}

function isTimeoutLikeError(error) {
  return /timeout|timed out|aborted/i.test(String(error?.message || error || ""));
}

function truncateText(value, maxLength = 80) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function escapeLinkLabel(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function getTrackUrl(track) {
  const url = String(track?.info?.uri || track?.uri || track?.info?.url || track?.url || "").trim();
  return /^https?:\/\//i.test(url) ? url : null;
}

function getTrackAlbum(track) {
  const candidates = [
    track?.info?.albumName,
    track?.info?.album?.name,
    track?.pluginInfo?.albumName,
    track?.pluginInfo?.album?.name,
    track?.pluginInfo?.album,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  return null;
}

function getTrackPlaylistName(track) {
  const candidates = [
    track?.info?.playlistName,
    track?.info?.playlist?.name,
    track?.pluginInfo?.playlistName,
    track?.pluginInfo?.playlist?.name,
    track?.playlist?.name,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  return null;
}

function dedupeTracks(tracks) {
  const seen = new Set();
  const unique = [];

  for (const track of Array.isArray(tracks) ? tracks : []) {
    if (!track) continue;
    const identity = String(
      track?.encoded ||
      track?.track ||
      track?.info?.identifier ||
      `${getTrackTitle(track)}::${getTrackAuthor(track)}::${getTrackDuration(track)}`
    );

    if (seen.has(identity)) continue;
    seen.add(identity);
    unique.push(track);
  }

  return unique;
}

function buildSongEntries(tracks) {
  return (Array.isArray(tracks) ? tracks : []).map((track, index) => ({
    id: `song_${index}`,
    type: "song",
    title: getTrackTitle(track),
    subtitle: `Duration: ${isTrackLive(track) ? "LIVE" : convertTime(getTrackDuration(track))}`,
    url: getTrackUrl(track),
    track,
  }));
}

function buildArtistEntries(tracks) {
  const seen = new Set();
  const entries = [];

  for (const track of Array.isArray(tracks) ? tracks : []) {
    const author = truncateText(getTrackAuthor(track), 80);
    const key = author.toLowerCase();
    if (!author || seen.has(key)) continue;
    seen.add(key);
    entries.push({
      id: `artist_${entries.length}`,
      type: "artist",
      title: author,
      subtitle: `Top result: ${truncateText(getTrackTitle(track), 70)}`,
      url: getTrackUrl(track),
      query: author,
    });
  }

  return entries;
}

function buildAlbumEntries(tracks) {
  const groupedAlbums = new Map();

  for (const track of Array.isArray(tracks) ? tracks : []) {
    const album = String(getTrackAlbum(track) || "").trim();
    if (!album) continue;

    const key = album.toLowerCase();
    if (!groupedAlbums.has(key)) {
      groupedAlbums.set(key, {
        album,
        primaryAuthor: getTrackAuthor(track),
        tracks: [],
      });
    }

    groupedAlbums.get(key).tracks.push(track);
  }

  return Array.from(groupedAlbums.values()).map((group, index) => {
    const albumTracks = dedupeTracks(group.tracks);
    const artist = truncateText(group.primaryAuthor, 60);

    return {
      id: `album_${index}`,
      type: "album",
      title: truncateText(group.album, 80),
      subtitle: `Artist: ${artist} | ${albumTracks.length} track(s)`,
      url: getTrackUrl(albumTracks[0]),
      tracks: albumTracks,
      matchName: group.album,
      query: `${group.album} ${group.primaryAuthor}`.trim(),
    };
  });
}

function buildPlaylistEntries(searchResult) {
  const tracks = Array.isArray(searchResult?.tracks) ? searchResult.tracks : [];
  const entries = [];
  const groupedPlaylists = new Map();

  if (searchResult?.loadType === "PLAYLIST_LOADED" && searchResult?.playlist?.name && tracks.length) {
    const playlistName = String(searchResult.playlist.name).trim();
    if (playlistName) {
      const playlistTracks = dedupeTracks(tracks);
      entries.push({
        id: "playlist_loaded",
        type: "playlist",
        title: truncateText(playlistName, 80),
        subtitle: `${playlistTracks.length} track(s)`,
        url: null,
        tracks: playlistTracks,
        matchName: playlistName,
        query: playlistName,
      });
    }
  }

  for (const track of tracks) {
    const playlistName = String(getTrackPlaylistName(track) || "").trim();
    if (!playlistName) continue;

    const key = playlistName.toLowerCase();
    if (!groupedPlaylists.has(key)) {
      groupedPlaylists.set(key, {
        playlistName,
        primaryAuthor: getTrackAuthor(track),
        tracks: [],
      });
    }

    groupedPlaylists.get(key).tracks.push(track);
  }

  groupedPlaylists.forEach((group, key) => {
    const alreadyAdded = entries.some((entry) => entry.matchName?.toLowerCase() === key);
    if (alreadyAdded) return;

    const playlistTracks = dedupeTracks(group.tracks);
    entries.push({
      id: `playlist_${entries.length}`,
      type: "playlist",
      title: truncateText(group.playlistName, 80),
      subtitle: `${playlistTracks.length} track(s) | by ${truncateText(group.primaryAuthor, 45)}`,
      url: getTrackUrl(playlistTracks[0]),
      tracks: playlistTracks,
      matchName: group.playlistName,
      query: `${group.playlistName} ${group.primaryAuthor}`.trim(),
    });
  });

  return entries;
}

function getEntriesForTab(searchResult, tab) {
  const tracks = Array.isArray(searchResult?.tracks) ? searchResult.tracks : [];

  switch (tab) {
    case "artists":
      return buildArtistEntries(tracks);
    case "albums":
      return buildAlbumEntries(tracks);
    case "playlists":
      return buildPlaylistEntries(searchResult);
    case "songs":
    default:
      return buildSongEntries(tracks);
  }
}

function resolveAccentColor(color) {
  if (typeof color === "number" && Number.isFinite(color)) return color;

  const parsed = parseInt(String(color || "").replace(/^#/, ""), 16);
  return Number.isFinite(parsed) ? parsed : 0xff0051;
}

function createSearchTabRow(activeTab, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("search_tab_songs").setLabel("Songs").setStyle(activeTab === "songs" ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("search_tab_artists").setLabel("Artists").setStyle(activeTab === "artists" ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("search_tab_albums").setLabel("Albums").setStyle(activeTab === "albums" ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("search_tab_playlists").setLabel("Playlists").setStyle(activeTab === "playlists" ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId("search_close").setLabel("X").setStyle(ButtonStyle.Secondary).setDisabled(disabled)
  );
}

function createSearchNavigationRow(pageIndex, totalPages, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("search_page_first").setLabel("First").setStyle(ButtonStyle.Secondary).setDisabled(disabled || pageIndex <= 0),
    new ButtonBuilder().setCustomId("search_page_prev").setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(disabled || pageIndex <= 0),
    new ButtonBuilder().setCustomId("search_page_indicator").setLabel(`Page ${pageIndex + 1}/${Math.max(1, totalPages)}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId("search_page_next").setLabel("Next").setStyle(ButtonStyle.Primary).setDisabled(disabled || pageIndex >= totalPages - 1),
    new ButtonBuilder().setCustomId("search_page_last").setLabel("Last").setStyle(ButtonStyle.Primary).setDisabled(disabled || pageIndex >= totalPages - 1)
  );
}

function buildClosedSearchComponents(text, embedColor) {
  return [
    new ContainerBuilder()
      .setAccentColor(resolveAccentColor(embedColor))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(text)),
  ];
}

function buildSearchPanel(query, tab, pageIndex, searchResult, embedColor, getEmoji, { disabled = false } = {}) {
  const entries = getEntriesForTab(searchResult, tab);
  const totalPages = Math.max(1, Math.ceil(entries.length / SEARCH_PANEL_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, pageIndex), totalPages - 1);
  const start = safePage * SEARCH_PANEL_PAGE_SIZE;
  const visibleEntries = entries.slice(start, start + SEARCH_PANEL_PAGE_SIZE);
  const container = new ContainerBuilder().setAccentColor(resolveAccentColor(embedColor));
  const tabLabel = {
    songs: "Songs",
    artists: "Artists",
    albums: "Albums",
    playlists: "Playlists",
  }[tab] || "Songs";

  container
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${getEmoji("search")} Search Results\n**${tabLabel}** for \`${truncateText(query, 60)}\``)
    )
    .addActionRowComponents(createSearchTabRow(tab, disabled));

  if (!visibleEntries.length) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`*No ${tab} results were available for \`${escapeLinkLabel(truncateText(query, 60))}\`.*`)
    );
  } else {
    visibleEntries.forEach((entry, index) => {
      const position = start + index + 1;
      const title = truncateText(entry.title, 90);
      const linkedTitle = entry.url ? `[${escapeLinkLabel(title)}](${entry.url})` : escapeLinkLabel(title);

      const addButton = new ButtonBuilder()
        .setCustomId(`search_add_${index}`)
        .setLabel("Add")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled);

      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${position}.** ${linkedTitle}`),
          new TextDisplayBuilder().setContent(truncateText(entry.subtitle, 120))
        )
        .setButtonAccessory(addButton);

      container.addSectionComponents(section);
    });
  }

  container.addActionRowComponents(createSearchNavigationRow(safePage, totalPages, disabled));

  return {
    components: [container],
    entries,
    visibleEntries,
    pageIndex: safePage,
    totalPages,
  };
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

    const ok = EMOJIS.ok;
    const no = EMOJIS.no;
    const query = args.join(" ").trim();

    if (!query) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("search")} Search Query Missing`)
        .setDescription(`${no} Usage: \`${prefix}search <song name>\``);
      return message.channel.send({ embeds: [embed] });
    }

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Voice Channel Required`)
        .setDescription(`${no} You must be connected to a voice channel to use this command.`);
      return message.channel.send({ embeds: [embed] });
    }

    if (message.member?.voice?.selfDeaf) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Cannot Run While Deafened`)
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`);
      return message.channel.send({ embeds: [embed] });
    }

    if (!client.lavalink) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Audio Backend Offline`)
        .setDescription(`${no} Lavalink is not connected yet. Please try again in a moment.`);
      return message.channel.send({ embeds: [embed] });
    }

    let player = client.lavalink.players.get(message.guild.id);
    if (player && voiceChannel.id !== player.voiceChannelId) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Wrong Voice Channel`)
        .setDescription(`${no} You must be connected to the same voice channel as me.`);
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

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitForVoiceBridge = async () => {
        const startedAt = Date.now();
        while ((Date.now() - startedAt) < 10000) {
          const botChannelId = message.guild.members.me?.voice?.channelId || null;
          const hasVoiceBridge = Boolean(
            player?.voice?.sessionId &&
            player?.voice?.token &&
            player?.voice?.endpoint
          );

          if (botChannelId === voiceChannel.id && hasVoiceBridge) {
            return true;
          }

          await sleep(200);
        }

        return false;
      };

      const ensurePlaybackStarted = async () => {
        if (player.state !== "CONNECTED" || message.guild.members.me?.voice?.channelId !== voiceChannel.id) {
          await player.connect();
        }

        const voiceReady = await waitForVoiceBridge();
        if (!voiceReady) return false;

        await player.play({ paused: false });
        return true;
      };
      const hasActivePlayback = () => (
        Boolean(player?.queue?.current) ||
        Boolean(player?.playing) ||
        Boolean(player?.paused) ||
        (Array.isArray(player?.queue?.tracks) && player.queue.tracks.length > 0)
      );
      const getQueuedTrackCount = () => {
        if (Array.isArray(player?.queue?.tracks)) return player.queue.tracks.length;
        if (Array.isArray(player?.queue?.items)) return player.queue.items.length;
        if (Number.isFinite(Number(player?.queue?.size))) return Math.max(0, Number(player.queue.size));
        if (Number.isFinite(Number(player?.queue?.length))) return Math.max(0, Number(player.queue.length));
        return 0;
      };
      const searchWithAvailableSources = async (queryText, requester, { preferredSources = SEARCH_SOURCE_ORDER, timeoutMs = 10000, logPrefix = "Search" } = {}) => {
        const availability = getAvailableSearchSources(client, player, preferredSources);
        const attemptedSources = availability.sources.slice();
        let lastError = null;

        if (!attemptedSources.length) {
          return {
            result: null,
            attemptedSources,
            advertisedSources: availability.advertisedSources,
            hasNodeInfo: availability.hasNodeInfo,
            lastError: new Error(
              availability.hasNodeInfo
                ? `No supported search sources are enabled on this Lavalink node. Available sources: ${formatSourceList(availability.advertisedSources)}`
                : "No searchable sources are available yet."
            ),
          };
        }

        for (const source of attemptedSources) {
          try {
            const result = await Promise.race([
              player.search({ query: queryText, source }, requester),
              new Promise((_, reject) => setTimeout(() => reject(new Error(`${source} search timeout`)), timeoutMs)),
            ]);

            if (result?.loadType === "LOAD_FAILED") {
              throw result.exception || new Error(`${source} search failed`);
            }

            if (result?.tracks?.length) {
              return {
                result,
                attemptedSources,
                advertisedSources: availability.advertisedSources,
                hasNodeInfo: availability.hasNodeInfo,
                lastError: null,
              };
            }
          } catch (error) {
            lastError = error;
            if (!/has not '.*' enabled|has not .* enabled|required to have|Query \/ Link Provided for this Source/i.test(String(error?.message || error || ""))) {
              client.logger?.log?.(`${logPrefix} failed for ${source}: ${error?.message || error}`, "warn");
            }
          }
        }

        return {
          result: null,
          attemptedSources,
          advertisedSources: availability.advertisedSources,
          hasNodeInfo: availability.hasNodeInfo,
          lastError,
        };
      };
      const describeSearchFailure = (attempt) => {
        if (!attempt) return "I could not fetch results for this query. Try another keyword.";
        if (attempt.hasNodeInfo && attempt.attemptedSources.length === 0) {
          return `No supported search sources are enabled on this Lavalink node. Available sources: ${formatSourceList(attempt.advertisedSources)}.`;
        }
        if (attempt.lastError && isTimeoutLikeError(attempt.lastError)) {
          const sourceLabel = String(attempt.attemptedSources[0] || "Search");
          const titled = sourceLabel.charAt(0).toUpperCase() + sourceLabel.slice(1);
          return `${titled} search timed out. Lavalink is responding too slowly right now.`;
        }
        return "I could not fetch results for this query. Try another keyword.";
      };

      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes("youtube.com") || lowerQuery.includes("youtu.be")) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("error")} Unsupported URL`)
          .setDescription("YouTube links are not supported here. Use Spotify, SoundCloud, Bandcamp, or plain search text.");
        return message.channel.send({ embeds: [embed] });
      }

      let searchResult;
      let searchAttempt = null;
      try {
        searchAttempt = await searchWithAvailableSources(query, message.member.user, {
          preferredSources: SEARCH_SOURCE_ORDER,
          timeoutMs: 8000,
          logPrefix: "Search",
        });
        searchResult = searchAttempt.result;
        if (searchResult.loadType === "LOAD_FAILED") throw searchResult.exception;
      } catch (err) {
        client.logger?.log?.(err?.stack || err?.message || String(err), "error");
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("error")} Search Failed`)
          .setDescription(describeSearchFailure(searchAttempt));
        return message.channel.send({ embeds: [embed] });
      }

      if (!searchResult?.tracks?.length) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`${getEmoji("search")} No Results`)
          .setDescription(`${ok} No tracks were found for that query.`);
        return message.channel.send({ embeds: [embed] });
      }

      const queueTracks = async (tracks) => {
        const items = (Array.isArray(tracks) ? tracks : [tracks]).filter(Boolean);
        if (!items.length) return 0;
        await player.queue.add(items);
        return items.length;
      };

      const resolveEntryTracks = async (entry) => {
        if (!entry) return [];
        if (entry.track) return [entry.track];
        if (Array.isArray(entry.tracks) && entry.tracks.length) return dedupeTracks(entry.tracks);
        if (!entry.query) return [];

        const addAttempt = await searchWithAvailableSources(entry.query, message.member.user, {
          preferredSources: SEARCH_SOURCE_ORDER,
          timeoutMs: 8000,
          logPrefix: `Search panel ${entry.type}`,
        });

        if (!addAttempt.result?.tracks?.length) {
          const error = addAttempt.lastError || new Error(`No ${entry.type} results were found.`);
          error.searchAttempt = addAttempt;
          throw error;
        }

        if ((entry.type === "album" || entry.type === "playlist") && addAttempt.result.loadType === "PLAYLIST_LOADED") {
          return dedupeTracks(addAttempt.result.tracks);
        }

        if (entry.type === "album" || entry.type === "playlist") {
          const expectedName = String(entry.matchName || entry.title || "").trim().toLowerCase();
          const matchingTracks = addAttempt.result.tracks.filter((track) => {
            const value = entry.type === "album" ? getTrackAlbum(track) : getTrackPlaylistName(track);
            return String(value || "").trim().toLowerCase() === expectedName;
          });

          if (matchingTracks.length) return dedupeTracks(matchingTracks);
        }

        return [addAttempt.result.tracks[0]];
      };

      let currentTab = "songs";
      let currentPage = 0;
      const getPanelState = (disabled = false) => {
        const state = buildSearchPanel(query, currentTab, currentPage, searchResult, embedColor, getEmoji, { disabled });
        currentPage = state.pageIndex;
        return state;
      };

      let panelState = getPanelState();
      const panelMessage = await message.channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: panelState.components,
      });

      const collector = panelMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 90000,
      });

      collector.on("collect", async (buttonInteraction) => {
        if (buttonInteraction.user.id !== message.author.id) {
          await buttonInteraction.reply({
            content: `Only <@${message.author.id}> can use this panel.`,
            ephemeral: true,
          }).catch(() => {});
          return;
        }

        if (buttonInteraction.customId === "search_close") {
          await buttonInteraction.update({
            components: buildClosedSearchComponents(`${ok} Search panel closed.`, embedColor),
          }).catch(() => {});
          collector.stop("closed");
          return;
        }

        if (buttonInteraction.customId.startsWith("search_tab_")) {
          currentTab = buttonInteraction.customId.replace("search_tab_", "");
          currentPage = 0;
          panelState = getPanelState();
          await buttonInteraction.update({
            components: panelState.components,
          }).catch(() => {});
          collector.resetTimer();
          return;
        }

        if (buttonInteraction.customId.startsWith("search_page_")) {
          if (buttonInteraction.customId === "search_page_first") currentPage = 0;
          if (buttonInteraction.customId === "search_page_prev") currentPage = Math.max(0, currentPage - 1);
          if (buttonInteraction.customId === "search_page_next") currentPage += 1;
          if (buttonInteraction.customId === "search_page_last") {
            const totalEntries = getEntriesForTab(searchResult, currentTab).length;
            currentPage = Math.max(0, Math.ceil(totalEntries / SEARCH_PANEL_PAGE_SIZE) - 1);
          }

          panelState = getPanelState();
          await buttonInteraction.update({
            components: panelState.components,
          }).catch(() => {});
          collector.resetTimer();
          return;
        }

        if (buttonInteraction.customId.startsWith("search_add_")) {
          const slot = Number(buttonInteraction.customId.replace("search_add_", ""));
          panelState = getPanelState();
          const entry = panelState.visibleEntries[slot];

          if (!entry) {
            await buttonInteraction.reply({ content: "That result slot is empty.", ephemeral: true }).catch(() => {});
            return;
          }

          await buttonInteraction.deferUpdate().catch(() => {});

          try {
            const queueBefore = hasActivePlayback();
            const queuedCountBefore = getQueuedTrackCount();
            const hasCurrentBefore = Boolean(player?.queue?.current);
            const tracksToAdd = await resolveEntryTracks(entry);
            const addedCount = await queueTracks(tracksToAdd);

            if (!queueBefore) {
              const started = await ensurePlaybackStarted();
              if (!started) throw new Error("Failed to start playback.");
            }

            const linkedText = entry.url
              ? `[${escapeLinkLabel(truncateText(entry.title, 60))}](${entry.url})`
              : truncateText(entry.title, 60);

            const successText = addedCount > 1
              ? `**Added** **${addedCount}** track(s) from ${linkedText}.`
              : `**Added** ${linkedText}.`;
            const firstPosition = queuedCountBefore + (hasCurrentBefore ? 2 : 1);
            const lastPosition = firstPosition + Math.max(0, addedCount - 1);
            const positionLabel = addedCount > 1
              ? `#${firstPosition}-#${lastPosition}`
              : `#${firstPosition}`;
            const authorLabel = addedCount > 1
              ? `Tracks Queued  Positions #${positionLabel}`
              : `Track Queued  Position #${positionLabel}`;

            await buttonInteraction.followUp({
              embeds: [
                new EmbedBuilder()
                  .setColor(embedColor)
                  .setAuthor({
                    name: authorLabel,
                    iconURL: message.member.displayAvatarURL({ size: 64, extension: "png" }),
                  })
                  .setDescription(successText)
              ],
              ephemeral: true,
            }).catch(() => {});
          } catch (error) {
            client.logger?.log?.(error?.stack || error?.message || String(error), "error");
            const failureMessage = error?.searchAttempt
              ? describeSearchFailure(error.searchAttempt)
              : (error?.message || "Failed to add that result.");

            await buttonInteraction.followUp({
              embeds: [
                new EmbedBuilder()
                  .setColor(embedColor)
                  .setTitle(`${getEmoji("error")} Add Failed`)
                  .setDescription(`${no} ${failureMessage}`)
              ],
              ephemeral: true,
            }).catch(() => {});
          }

          collector.resetTimer();
        }
      });

      collector.on("end", async (_collected, reason) => {
        if (reason === "closed") return;
        try {
          panelState = getPanelState(true);
          await panelMessage.edit({
            components: panelState.components,
          }).catch(() => {});
        } catch (err) {
          client.logger?.log?.(`Prefix search panel end handler error: ${err?.message || err}`, "warn");
        }
      });
    } catch (err) {
      client.logger?.log?.(err?.stack || err?.message || String(err), "error");
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${getEmoji("error")} Search Error`)
        .setDescription(`${no} Something went wrong while processing search.`);
      return message.channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
};

