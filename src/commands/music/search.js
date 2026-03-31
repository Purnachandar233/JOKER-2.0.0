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

const fetch = require("isomorphic-unfetch");
const { getPreview, getTracks } = require("spotify-url-info")(fetch);
const { withTimeout } = require("../../utils/promiseHandler.js");
const { safeReply } = require("../../utils/interactionResponder");
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

const USER_SEARCH_SOURCE_ATTEMPTS = 2;
const USER_SEARCH_TIMEOUT_MS = 3000;
const USER_FALLBACK_SEARCH_TIMEOUT_MS = 2500;
const SPOTIFY_DIRECT_LOAD_TIMEOUT_MS = 5000;
const SPOTIFY_PLAYLIST_FALLBACK_TRACK_LIMIT = 8;
const SEARCH_PANEL_PAGE_SIZE = 5;
const VOICE_BRIDGE_TIMEOUT_MS = 5000;

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

function normalizeSearchResult(searchResult, sourceQuery = null) {
  if (!searchResult || typeof searchResult !== "object") return searchResult;

  if (typeof searchResult.loadType === "string") {
    const loadType = searchResult.loadType.trim().toUpperCase();

    if (loadType === "PLAYLIST" || loadType === "PLAYLIST_LOADED" || loadType === "PLAYLISTS") {
      searchResult.loadType = "PLAYLIST_LOADED";
    } else if (loadType === "TRACK" || loadType === "TRACK_LOADED") {
      searchResult.loadType = "TRACK_LOADED";
    } else if (loadType === "SEARCH" || loadType === "SEARCH_RESULT" || loadType === "SEARCHRESULT") {
      searchResult.loadType = "SEARCH_RESULT";
    } else if (loadType === "NO_MATCHES" || loadType === "NOMATCHES" || loadType === "NO_MATCH") {
      searchResult.loadType = "NO_MATCHES";
    } else if (loadType === "LOAD_FAILED") {
      searchResult.loadType = "LOAD_FAILED";
    } else {
      searchResult.loadType = loadType;
    }
  }

  if (sourceQuery && !searchResult.sourceQuery) {
    searchResult.sourceQuery = sourceQuery;
  }

  return searchResult;
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

function buildAlbumEntries(tracks, options = {}) {
  const resolveQuery = String(options.resolveQuery || "").trim() || null;
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
      resolveQuery,
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
        query: searchResult?.sourceQuery || playlistName,
        resolveQuery: searchResult?.sourceQuery || null,
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
      resolveQuery: searchResult?.sourceQuery || null,
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
      return buildAlbumEntries(tracks, { resolveQuery: searchResult?.sourceQuery || null });
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
        .setEmoji(getEmoji("addsong"))
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
        .setAuthor({ name: ` Voice Channel Required`, iconURL: message.member.displayAvatarURL({ dynamic: true }) })
        .setDescription(`${no} You must be connected to a voice channel to use this command.`);
      return message.channel.send({ embeds: [embed] });
    }

    if (message.member?.voice?.selfDeaf) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: ` Cannot Run While Deafened`, iconURL: message.member.displayAvatarURL({ dynamic: true }) })
        .setDescription(`${no} <@${message.member.id}> You cannot run this command while deafened.`);
      return message.channel.send({ embeds: [embed] });
    }

    if (!client.lavalink) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: ` Audio Backend Offline`, iconURL: message.member.displayAvatarURL({ dynamic: true }) })
        .setDescription(`${no} Lavalink is not connected yet. Please try again in a moment.`);
      return message.channel.send({ embeds: [embed] });
    }

    const musicCore = client.core.music;
    const SEARCH_SOURCE_ORDER = musicCore.DEFAULT_SEARCH_SOURCE_ORDER;

    let player = client.lavalink.players.get(message.guild.id);
    if (player && voiceChannel.id !== player.voiceChannelId) {
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: ` Wrong Voice Channel`, iconURL: message.member.displayAvatarURL({ dynamic: true }) })
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

      const ensurePlaybackStarted = async (directTrack = null) => {
        return musicCore.ensurePlayerPlayback({
          player,
          guild: message.guild,
          channelId: voiceChannel.id,
          directTrack,
          timeoutMs: VOICE_BRIDGE_TIMEOUT_MS,
          recoverVolume: true,
          logger: client.logger,
        });
      };
      const getQueuedTrackCount = () => {
        if (Array.isArray(player?.queue?.tracks)) return player.queue.tracks.length;
        if (Array.isArray(player?.queue?.items)) return player.queue.items.length;
        if (Number.isFinite(Number(player?.queue?.size))) return Math.max(0, Number(player.queue.size));
        if (Number.isFinite(Number(player?.queue?.length))) return Math.max(0, Number(player.queue.length));
        return 0;
      };
      const searchWithAvailableSources = async (
        queryText,
        requester,
        {
          preferredSources = SEARCH_SOURCE_ORDER,
          timeoutMs = USER_SEARCH_TIMEOUT_MS,
          logPrefix = "Search",
          maxSourceAttempts = USER_SEARCH_SOURCE_ATTEMPTS,
        } = {}
      ) => {
        return musicCore.searchWithAvailableSources({
          player,
          queryText,
          requester,
          preferredSources,
          timeoutMs,
          logPrefix,
          maxSourceAttempts,
        });
      };
      const describeSearchFailure = (attempt) => {
        if (!attempt) return "I could not fetch results for this query. Try another keyword.";
        if (attempt.hasNodeInfo && attempt.attemptedSources.length === 0) {
          return `No supported search sources are enabled on this Lavalink node. Available sources: ${musicCore.formatSourceList(attempt.advertisedSources)}.`;
        }
        if (attempt.lastError && musicCore.isTimeoutLikeError(attempt.lastError)) {
          const sourceLabel = String(attempt.attemptedSources[0] || "Search");
          const titled = sourceLabel.charAt(0).toUpperCase() + sourceLabel.slice(1);
          return `${titled} search timed out. Lavalink is responding too slowly right now.`;
        }
        return "I could not fetch results for this query. Try another keyword.";
      };
      const loadSpotifyUrlResult = async (queryText, requester) => {
        let spotifyResult = null;
        let lastAttempt = null;
        let fallbackQuery = queryText;

        try {
          const directLoadPromise = player.search({ query: queryText }, requester);
          spotifyResult = normalizeSearchResult(
            await withTimeout(directLoadPromise, SPOTIFY_DIRECT_LOAD_TIMEOUT_MS, "Direct Spotify load timeout"),
            queryText
          );
        } catch (directErr) {
          client.logger?.log?.(`Search panel direct Spotify load failed: ${directErr?.message || directErr}`, "warn");
        }

        if (spotifyResult?.tracks?.length) {
          return { result: spotifyResult, attempt: lastAttempt };
        }

        try {
          const tracksInfo = await getTracks(queryText).catch(() => null);
          if (Array.isArray(tracksInfo) && tracksInfo.length) {
            const foundTracks = [];
            const searchLimit = Math.min(tracksInfo.length, SPOTIFY_PLAYLIST_FALLBACK_TRACK_LIMIT);

            for (const trackInfo of tracksInfo.slice(0, searchLimit)) {
              const fallbackTrackQuery = `${trackInfo?.name || ""} ${trackInfo?.artists?.[0]?.name || ""}`.trim();
              if (!fallbackTrackQuery) continue;

              const trackAttempt = await searchWithAvailableSources(fallbackTrackQuery, requester, {
                preferredSources: SEARCH_SOURCE_ORDER,
                timeoutMs: USER_FALLBACK_SEARCH_TIMEOUT_MS,
                logPrefix: "Search panel Spotify track fallback",
                maxSourceAttempts: 2,
              });
              lastAttempt = trackAttempt;

              if (trackAttempt.result?.tracks?.length) {
                foundTracks.push(trackAttempt.result.tracks[0]);
              }
            }

            if (foundTracks.length) {
              spotifyResult = normalizeSearchResult({
                loadType: "PLAYLIST_LOADED",
                tracks: foundTracks,
                playlist: {
                  name: tracksInfo.name || tracksInfo.title || "Spotify Collection",
                },
              }, queryText);
              return { result: spotifyResult, attempt: lastAttempt };
            }
          }
        } catch (tracksErr) {
          client.logger?.log?.(`Search panel Spotify tracks fallback failed: ${tracksErr?.message || tracksErr}`, "warn");
        }

        try {
          const preview = await getPreview(queryText).catch(() => null);
          if (preview) {
            fallbackQuery = `${preview.title || ""} ${preview.artist || ""}`.trim() || queryText;
          }
        } catch (previewErr) {
          client.logger?.log?.(`Search panel Spotify preview fallback failed: ${previewErr?.message || previewErr}`, "warn");
        }

        const spotifyPreferred = musicCore.getAvailableSearchSources(player, ["spotify"]).sources.length
          ? ["spotify"]
          : SEARCH_SOURCE_ORDER;
        const fallbackAttempt = await searchWithAvailableSources(fallbackQuery, requester, {
          preferredSources: spotifyPreferred,
          timeoutMs: USER_FALLBACK_SEARCH_TIMEOUT_MS,
          logPrefix: "Search panel Spotify fallback",
          maxSourceAttempts: 2,
        });

        return {
          result: normalizeSearchResult(fallbackAttempt.result, queryText),
          attempt: fallbackAttempt,
        };
      };
      const loadSearchPanelResult = async (queryText, requester) => {
        const isDirectUrl = /^https?:\/\//i.test(queryText);
        const isSpotifyUrl = /https?:\/\/(open\.spotify\.com|spotify\.link)/i.test(queryText);

        if (isDirectUrl && !/youtu\.be|youtube\.com/i.test(queryText)) {
          try {
            const directLoadPromise = player.search({ query: queryText }, requester);
            const directResult = normalizeSearchResult(
              await withTimeout(directLoadPromise, SPOTIFY_DIRECT_LOAD_TIMEOUT_MS, "Direct source load timeout"),
              queryText
            );

            if (directResult?.tracks?.length) {
              return { result: directResult, attempt: null };
            }
          } catch (directErr) {
            client.logger?.log?.(`Search panel direct URL load failed: ${directErr?.message || directErr}`, "warn");
          }
        }

        if (isSpotifyUrl) {
          return loadSpotifyUrlResult(queryText, requester);
        }

        const attempt = await searchWithAvailableSources(queryText, requester, {
          preferredSources: SEARCH_SOURCE_ORDER,
          timeoutMs: USER_SEARCH_TIMEOUT_MS,
          logPrefix: "Search",
        });

        return {
          result: normalizeSearchResult(attempt.result, queryText),
          attempt,
        };
      };

      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes("youtube.com") || lowerQuery.includes("youtu.be")) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setAuthor({ name: `${getEmoji("error")} Unsupported URL`, iconURL: message.member.displayAvatarURL({ dynamic: true }) })
          .setDescription("YouTube links are not supported here. Use Spotify, SoundCloud, Bandcamp, or plain search text.");
        return message.channel.send({ embeds: [embed] });
      }

      let searchResult;
      let searchAttempt = null;
      try {
        const initialLoad = await loadSearchPanelResult(query, message.member.user);
        searchAttempt = initialLoad.attempt;
        searchResult = initialLoad.result;
        if (searchResult?.loadType === "LOAD_FAILED") throw searchResult.exception;
      } catch (err) {
        client.logger?.log?.(err?.stack || err?.message || String(err), "error");
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setAuthor({ name: `${getEmoji("error")} Search Failed`, iconURL: message.member.displayAvatarURL({ dynamic: true }) })
          .setDescription(describeSearchFailure(searchAttempt));
        return message.channel.send({ embeds: [embed] });
      }

      if (!searchResult?.tracks?.length) {
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setAuthor({ name: `No Results`, iconURL: message.member.displayAvatarURL({ dynamic: true }) })
          .setDescription(`${ok} No tracks were found for that query.`);
        return message.channel.send({ embeds: [embed] });
      }

      const resolveEntryTracks = async (entry) => {
        if (!entry) return [];
        if (entry.track) return [entry.track];
        if ((entry.type === "album" || entry.type === "playlist") && entry.resolveQuery) {
          try {
            const directLoad = await loadSearchPanelResult(entry.resolveQuery, message.member.user);
            if (directLoad.result?.tracks?.length) {
              return dedupeTracks(directLoad.result.tracks);
            }
          } catch (error) {
            client.logger?.log?.(`Search panel ${entry.type} direct resolve failed: ${error?.message || error}`, "warn");
          }
        }
        if (Array.isArray(entry.tracks) && entry.tracks.length) return dedupeTracks(entry.tracks);
        if (!entry.query) return [];

        const addAttempt = await searchWithAvailableSources(entry.query, message.member.user, {
          preferredSources: SEARCH_SOURCE_ORDER,
          timeoutMs: USER_SEARCH_TIMEOUT_MS,
          logPrefix: `Search panel ${entry.type}`,
          maxSourceAttempts: 2,
        });
        addAttempt.result = normalizeSearchResult(addAttempt.result, entry.query);

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

      const tabSearchResults = new Map([
        ["songs", searchResult],
        ["artists", searchResult],
        ["albums", searchResult],
        ["playlists", searchResult],
      ]);
      const attemptedTabSearches = new Set();
      const getSearchResultForTab = (tab) => tabSearchResults.get(tab) || searchResult;
      const ensureTabSearchResult = async (tab) => {
        if (!["albums", "playlists"].includes(tab)) {
          return getSearchResultForTab(tab);
        }

        const currentResult = getSearchResultForTab(tab);
        if (getEntriesForTab(currentResult, tab).length) {
          return currentResult;
        }

        if (attemptedTabSearches.has(tab)) {
          return currentResult;
        }

        attemptedTabSearches.add(tab);
        const tabQuery = `${query} ${tab === "albums" ? "album" : "playlist"}`.trim();

        try {
          const tabLoad = await loadSearchPanelResult(tabQuery, message.member.user);
          const nextResult = normalizeSearchResult(tabLoad?.result, tabQuery);

          if (nextResult?.tracks?.length && getEntriesForTab(nextResult, tab).length) {
            tabSearchResults.set(tab, nextResult);
            return nextResult;
          }
        } catch (error) {
          client.logger?.log?.(`Search panel ${tab} lookup failed: ${error?.message || error}`, "warn");
        }

        return currentResult;
      };

      let currentTab = "songs";
      let currentPage = 0;
      const getPanelState = (disabled = false) => {
        const activeSearchResult = getSearchResultForTab(currentTab);
        const state = buildSearchPanel(query, currentTab, currentPage, activeSearchResult, embedColor, getEmoji, { disabled });
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
          await ensureTabSearchResult(currentTab);
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
            const totalEntries = getEntriesForTab(getSearchResultForTab(currentTab), currentTab).length;
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
            await safeReply(buttonInteraction, { content: "That result slot is empty.", ephemeral: true });
            return;
          }

          await buttonInteraction.deferUpdate().catch(() => {});

          try {
            const queuedCountBefore = getQueuedTrackCount();
            const tracksToAdd = await resolveEntryTracks(entry);
            const normalizedTracks = (Array.isArray(tracksToAdd) ? tracksToAdd : [tracksToAdd]).filter(Boolean);
            const addedCount = normalizedTracks.length;
            const hadActivePlayback = Boolean(player?.queue?.current || player?.playing || player?.paused);
            const shouldShowQueuedState = hadActivePlayback || queuedCountBefore > 0;
            const { queueTracksForPlayback } = client.core.queue;
            const playbackResult = await queueTracksForPlayback(
              player,
              tracksToAdd,
              (directTrack) => ensurePlaybackStarted(directTrack)
            );

            if (!playbackResult.hadActivePlayback && !playbackResult.startedPlayback) {
              throw new Error("Failed to start playback.");
            }

            const linkedText = entry.url
              ? `[${escapeLinkLabel(truncateText(entry.title, 60))}](${entry.url})`
              : truncateText(entry.title, 60);

            const firstPosition = queuedCountBefore + 1;
            const lastPosition = firstPosition + Math.max(0, addedCount - 1);
            const firstTrack = normalizedTracks[0] || null;
            const firstTrackTitle = firstTrack
              ? client.core.queue.formatQueueTrackTitle(firstTrack, 70)
              : linkedText;
            const firstTrackLength = firstTrack
              ? client.core.queue.formatTrackLength(firstTrack)
              : null;
            const authorLabel = addedCount > 1
              ? (shouldShowQueuedState ? `Tracks queued - Positions #${firstPosition}-#${lastPosition}` : "Tracks queued")
              : (shouldShowQueuedState ? `Track queued - Position #${firstPosition}` : "Now playing");
            const successText = addedCount > 1
              ? `Added **${addedCount}** track(s) from ${linkedText} to the queue`
              : (
                  shouldShowQueuedState
                    ? `Added ${firstTrackTitle} \`${firstTrackLength}\` to the queue`
                    : `Started ${firstTrackTitle} \`${firstTrackLength}\``
                );

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

