const { CommandInteraction, Client, EmbedBuilder, ApplicationCommandType } = require("discord.js");
const track = require('../../schema/trackinfoSchema.js')
const fetch = require('isomorphic-unfetch');
const { getData, getPreview, getTracks, getDetails } = require('spotify-url-info')(fetch)

const SEARCH_SOURCE_ORDER = ['spotify', 'soundcloud', 'applemusic', 'deezer', 'bandcamp'];

function normalizeSourceName(source) {
  const value = String(source || '').trim().toLowerCase();
  if (!value) return null;

  if (['spotify', 'spsearch', 'sp'].includes(value)) return 'spotify';
  if (['soundcloud', 'scsearch', 'sc'].includes(value)) return 'soundcloud';
  if (['applemusic', 'apple', 'apple music', 'amsearch', 'am'].includes(value)) return 'applemusic';
  if (['deezer', 'dzsearch', 'dz', 'dzisrc'].includes(value)) return 'deezer';
  if (['bandcamp', 'bcsearch', 'bc'].includes(value)) return 'bandcamp';

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
  return Array.isArray(sources) && sources.length ? sources.join(', ') : 'none';
}

function isTimeoutLikeError(error) {
  return /timeout|timed out|aborted/i.test(String(error?.message || error || ''));
}
module.exports = {
  name: "play",
  description: "plays some high quality music",
  owner: false,
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "query",
      description: "name link etc.",
      required: true,
      type: 3
    }
  ],

  run: async (client, interaction) => {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(err => client.logger?.log(`deferReply failed: ${err?.message || err}`, 'warn'));
    }

    const query = interaction.options.getString("query");
    if (!query) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription("Please provide a search input to search.")] }).catch(err => client.logger?.log(`editReply failed (no query): ${err?.message || err}`, 'warn'));

    const { channel } = interaction.member.voice;
    if (!channel) {
      const noperms = new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription(`You must be connected to a voice channel to use this command.`);
      return await interaction.editReply({ embeds: [noperms] }).catch(err => client.logger?.log(`editReply failed (not in VC): ${err?.message || err}`, 'warn'));
    }

    if (interaction.member.voice.selfDeaf) {
      let thing = new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription(`You cannot run this command while deafened.`);
      return await interaction.editReply({ embeds: [thing] }).catch(err => client.logger?.log(`editReply failed (deafened): ${err?.message || err}`, 'warn'));
    }

    if (!client.lavalink) {
      return await interaction.editReply({
        embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription("Lavalink is not connected yet. Please try again in a moment.")]
      }).catch(err => client.logger?.log(`editReply failed (lavalink missing): ${err?.message || err}`, 'warn'));
    }

    if (typeof client.waitForLavalinkReady === 'function') {
      const lavalinkReady = await client.waitForLavalinkReady(2500);
      if (!lavalinkReady) {
        return await interaction.editReply({
          embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription("No Lavalink node is available right now. Please try again in a moment.")]
        }).catch(err => client.logger?.log(`editReply failed (lavalink not ready): ${err?.message || err}`, 'warn'));
      }
    }

    let player = client.lavalink.players.get(interaction.guildId);
    if (player && channel.id !== player.voiceChannelId) {
      const noperms = new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription(`You must be connected to the same voice channel as me.`);
      return await interaction.editReply({ embeds: [noperms] }).catch(err => client.logger?.log(`editReply failed (youtube block): ${err?.message || err}`, 'warn'));
    }

    // Create player if it doesn't exist
    if (!player) {
      player = client.lavalink.createPlayer({
        guildId: interaction.guildId,
        textChannelId: interaction.channelId,
        voiceChannelId: interaction.member.voice.channelId,
        selfDeafen: true,
      });
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitForVoiceBridge = async (playerInstance, expectedChannelId) => {
      const startedAt = Date.now();
      while ((Date.now() - startedAt) < 10000) {
        const botChannelId = interaction.guild.members.me?.voice?.channelId || null;
        const hasVoiceBridge = Boolean(
          playerInstance?.voice?.sessionId &&
          playerInstance?.voice?.token &&
          playerInstance?.voice?.endpoint
        );

        if (botChannelId === expectedChannelId && hasVoiceBridge) {
          return true;
        }

        await sleep(200);
      }

      return false;
    };

    const queueTracksNative = async (playerInstance, tracks) => {
      const incoming = (Array.isArray(tracks) ? tracks : [tracks]).filter(Boolean);
      if (!incoming.length) return;

      if (typeof playerInstance.queue?.add === 'function') {
        await playerInstance.queue.add(incoming);
        return;
      }

      if (!Array.isArray(playerInstance.queue?.tracks)) {
        playerInstance.queue.tracks = [];
      }
      playerInstance.queue.tracks.push(...incoming);
    };
    const hasActivePlayback = (playerInstance) => (
      Boolean(playerInstance?.queue?.current) ||
      Boolean(playerInstance?.playing) ||
      Boolean(playerInstance?.paused) ||
      (Array.isArray(playerInstance?.queue?.tracks) && playerInstance.queue.tracks.length > 0)
    );
    const searchWithAvailableSources = async (queryText, requester, { preferredSources = SEARCH_SOURCE_ORDER, timeoutMs = 10000, logPrefix = 'Search' } = {}) => {
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
              : 'No searchable sources are available yet.'
          ),
        };
      }

      for (const source of attemptedSources) {
        try {
          const result = await Promise.race([
            player.search({ query: queryText, source }, requester),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`${source} search timeout`)), timeoutMs)),
          ]);

          if (result?.loadType === 'LOAD_FAILED') {
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
          if (!/has not '.*' enabled|has not .* enabled|required to have|Query \/ Link Provided for this Source/i.test(String(error?.message || error || ''))) {
            client.logger?.log(`${logPrefix} failed for ${source}: ${error?.message || error}`, 'warn');
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

    const ensurePlaybackStarted = async (playerInstance) => {
      try {
        if (playerInstance.state !== "CONNECTED" || interaction.guild.members.me?.voice?.channelId !== channel.id) {
          await playerInstance.connect();
        }

        const voiceReady = await waitForVoiceBridge(playerInstance, channel.id);
        if (!voiceReady) return false;

        // Auto-recover from accidental silent volume (0).
        try {
          const currentVolume = Number(playerInstance.volume ?? playerInstance?.options?.volume ?? 100);
          if (Number.isFinite(currentVolume) && currentVolume <= 0) {
            await playerInstance.setVolume(100);
          }
        } catch (_e) {}

        await playerInstance.play({ paused: false });
        return true;
      } catch (_err) {
        return false;
      }
    };
    const titleCase = (value) => {
      const text = String(value || '').trim();
      return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Search';
    };
    const describeSearchFailure = (attempt, fallbackMessage) => {
      if (!attempt) return fallbackMessage;

      if (attempt.hasNodeInfo && attempt.attemptedSources.length === 0) {
        return `No supported search sources are enabled on this Lavalink node. Available sources: ${formatSourceList(attempt.advertisedSources)}.`;
      }

      if (attempt.lastError && isTimeoutLikeError(attempt.lastError)) {
        const sourceLabel = titleCase(attempt.attemptedSources[0] || 'search');
        return `${sourceLabel} search timed out. Lavalink is responding too slowly right now.`;
      }

      return fallbackMessage;
    };

    if (query.toLowerCase().includes("youtube.com") || query.toLowerCase().includes("youtu.be")) {
      const noperms = new EmbedBuilder()
        .setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || 0xff0000)
        .setAuthor({ name: 'YouTube URL', iconURL: client.user.displayAvatarURL({ forceStatic: false }) })
        .setDescription(`We no longer support YouTube, please use other platforms like Spotify, SoundCloud or Bandcamp. Otherwise use a search query to use our default system.`);
      return await interaction.editReply({ embeds: [noperms] });
    }

    let s;
    let lastSearchAttempt = null;
    if (query.match(/https?:\/\/(open\.spotify\.com|spotify\.link)/)) {
      // Try direct URL loading first (works for playlists and tracks)
      try {
        const directLoadPromise = player.search(query, interaction.member.user);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Direct Spotify load timeout')), 10000)
        );
        s = await Promise.race([directLoadPromise, timeoutPromise]);
      } catch (directErr) {
        client.logger?.log(`Direct Spotify URL load failed: ${directErr.message}, trying search...`, 'warn');
        // Fallback: try to get track info and search
        let searchQuery = query;
        try {
          const data = await getPreview(query);
          searchQuery = `${data.title} ${data.artist}`;
          const spotifyPreferred = getAvailableSearchSources(client, player, ['spotify']).sources.length
            ? ['spotify']
            : SEARCH_SOURCE_ORDER;
          const searchAttempt = await searchWithAvailableSources(searchQuery, interaction.member.user, {
            preferredSources: spotifyPreferred,
            timeoutMs: 10000,
            logPrefix: 'Spotify preview search',
          });
          s = searchAttempt.result;
          lastSearchAttempt = searchAttempt;
        } catch (searchErr) {
          client.logger?.log(`Spotify URL search error: ${searchErr.message}`, 'error');
          // Fallback: search on other sources using extracted title/artist
          try {
            const fallbackAttempt = await searchWithAvailableSources(searchQuery, interaction.member.user, {
              preferredSources: SEARCH_SOURCE_ORDER,
              timeoutMs: 8000,
              logPrefix: 'Fallback search',
            });
            s = fallbackAttempt.result;
            lastSearchAttempt = fallbackAttempt;
            if (!s || !s.tracks || s.tracks.length === 0) {
              return await interaction.editReply({
                embeds: [new EmbedBuilder()
                  .setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051')
                  .setDescription(describeSearchFailure(lastSearchAttempt, 'Failed to load Spotify content from the enabled Lavalink sources. Please try again.'))]
              }).catch(err => client.logger?.log(`editReply failed (spotify fallback empty): ${err?.message || err}`, 'warn'));
            }
          } catch (fallbackErr) {
            client.logger?.log(`All fallback searches failed: ${fallbackErr.message}`, 'error');
            return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription('Failed to load Spotify content. Please try a different query.')] }).catch(err => client.logger?.log(`editReply failed (spotify all fallback): ${err?.message || err}`, 'warn'));
          }
        }
      }
    } else {
      const searchAttempt = await searchWithAvailableSources(query, interaction.member.user, {
        preferredSources: SEARCH_SOURCE_ORDER,
        timeoutMs: 8000,
        logPrefix: 'Search',
      });
      s = searchAttempt.result;
      lastSearchAttempt = searchAttempt;
    }

    if (!s || !s.tracks || s.tracks.length === 0) {
      if (player && (!player.queue?.current) && !(player.queue?.tracks?.length > 0)) await player.destroy().catch(() => {});
      return await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051')
          .setDescription(describeSearchFailure(lastSearchAttempt, 'No results found across the enabled Lavalink sources. Try a different query.'))]
      }).catch(err => client.logger?.log(`editReply failed (no results): ${err?.message || err}`, 'warn'));
    }

    if (!s || !s.tracks) {
      if (player && (!player.queue?.current) && !(player.queue?.tracks?.length > 0)) await player.destroy().catch(() => {});
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription('No results found.')] }).catch(err => client.logger?.log(`editReply failed (no results 2): ${err?.message || err}`, 'warn'));
    }

    if (s.tracks && Array.isArray(s.tracks)) {
        s.tracks = s.tracks.filter(track => {
            const uri = track.info?.uri || track.uri || '';
            return !uri.toLowerCase().includes('youtube.com') && !uri.toLowerCase().includes('youtu.be');
        });
        if ((s.loadType === "SEARCH_RESULT" || s.loadType === "TRACK_LOADED") && s.tracks.length === 0) s.loadType = "NO_MATCHES";
        if (s.loadType === "PLAYLIST_LOADED" && s.tracks.length === 0) s.loadType = "NO_MATCHES";
    }

      if (s.loadType === "LOAD_FAILED" || s.loadType === "NO_MATCHES" || !s.tracks || s.tracks.length === 0) {
      if (player && (!player.queue?.current) && !(player.queue?.tracks?.length > 0)) await player.destroy().catch(() => {});
      return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription('No results found.')] }).catch(err => client.logger?.log(`editReply failed (load failed): ${err?.message || err}`, 'warn'));
    }

    if (s.loadType === "PLAYLIST_LOADED" && s.playlist) {
        try {
            const { getQueueArray } = require('../../utils/queue.js');
            const existing = (getQueueArray(player) || []).map(t => t?.info?.identifier || t?.identifier || t?.id || t?.uri).filter(Boolean);
            const toAdd = [];
            for (const trackItem of s.tracks) {
                const id = trackItem?.info?.identifier || trackItem?.identifier || trackItem?.id || trackItem?.uri;
                if (id && existing.includes(id)) continue;
                toAdd.push(trackItem);
                if (id) existing.push(id);
            }
            const hadActivePlayback = hasActivePlayback(player);
            if (toAdd.length > 0) await queueTracksNative(player, toAdd);
            try { player.set('suppressUntil', Date.now() + 1200); } catch (e) {}
            if (!hadActivePlayback) {
              try {
                const started = await ensurePlaybackStarted(player);
                if (!started) throw new Error('no-track-started');
              } catch (e) {
                client.logger?.log('Failed to play playlist in guild ' + interaction.guildId + ': ' + (e && (e.message || e)), 'error');
                return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription("Failed to start playback. Please try again.")] }).catch(() => {});
              }
            }
            try { player.set('suppressUntil', Date.now()); } catch (e) {}
            const playlistName = s.playlist?.name || 'Unknown';
            const embed = new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription(`Queued **${toAdd.length}** tracks from **${playlistName}**`);
            return await interaction.editReply({ embeds: [embed] }).catch(() => {});
        } catch (err) {
            client.logger?.log('Playlist handling error: ' + (err && (err.stack || err.toString())), 'error');
            return await interaction.editReply({ embeds: [new EmbedBuilder().setColor(interaction.client?.embedColor || '#ff0051').setDescription('Failed to queue playlist.')] }).catch(() => {});
        }
    } else if (s.tracks && s.tracks[0]) {
        const hadActivePlayback = hasActivePlayback(player);
        await queueTracksNative(player, s.tracks[0]);
        if (!hadActivePlayback) {
          try {
            const started = await ensurePlaybackStarted(player);
            if (!started) throw new Error('no-track-started');
          } catch (e) {
            client.logger?.log(`Failed to play track in guild ${interaction.guildId}: ${e.message}`, 'error');
            return await interaction.editReply({ embeds: [new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription("Failed to start playback. Please try again.")] }).catch(err => client.logger?.log(`editReply failed (failed to play track): ${err?.message || err}`, 'warn'));
          }
        }
        const trackTitle = s.tracks[0].info?.title || s.tracks[0].title || 'Unknown';
        const embed = new EmbedBuilder().setColor((typeof interaction !== 'undefined' && interaction?.client?.embedColor) || (typeof client !== 'undefined' && client?.embedColor) || (typeof client !== 'undefined' && client.config?.embedColor) || '#ff0051').setDescription(`Queued **${trackTitle}** [\`${interaction.member.user.tag}\`]`);
        return await interaction.editReply({ embeds: [embed] }).catch(err => client.logger?.log(`editReply failed (track queued): ${err?.message || err}`, 'warn'));
    }
  },
};
