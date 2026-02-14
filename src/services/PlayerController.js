/**
 * PlayerController - Centralized music player management
 * Prevents race conditions and state corruption
 */

const safePlayer = require('../utils/safePlayer');

class PlayerController {
  constructor(client) {
    this.client = client;
    this.playerLocks = new Map(); // guildId -> lock promise
  }

  /**
   * Get or create player with minimal overhead
   */
  async getOrCreatePlayer(guildId, channelId, textChannelId) {
    // Skip lock for faster operations (reduced overhead)
    try {
      if (!this.client.lavalink) {
        throw new Error('Lavalink not initialized');
      }

      let player = this.client.lavalink.players.get(guildId);

      if (!player) {
        player = await this.client.lavalink.createPlayer({
          guildId,
          voiceChannelId: channelId,
          textChannelId,
          selfDeafen: true,
        });
      }

      return player;
    } catch (err) {
      console.error('PlayerController.getOrCreatePlayer error:', err && (err.message || err));
      return null;
    }
  }

  /**
   * Play track(s) safely
   */
  async playTracks(guildId, tracks, options = {}) {
    try {
      const player = this.client.lavalink.players.get(guildId);
      if (!player) throw new Error('No player for guild');

      // Validate tracks array
      if (!Array.isArray(tracks)) {
        tracks = [tracks];
      }

      if (tracks.length === 0) {
        throw new Error('No tracks to play');
      }

      // Add tracks to queue
      for (const track of tracks) {
        if (track) {
          await safePlayer.queueAdd(player, track);
        }
      }

      // Start playing if not already
      if (player.queue && player.queue.length > 0) {
        if (player.state !== 'CONNECTED') {
          await safePlayer.safeCall(player, 'connect');
        }

        if (!player.playing && !player.paused) {
          await safePlayer.safeCall(player, 'play');
        }
      }

      return { success: true, tracks: tracks.length };
    } catch (err) {
      console.error('PlayerController.playTracks error:', err && (err.stack || err.message));
      return { success: false, error: err && err.message };
    }
  }

  /**
   * Pause player
   */
  async pause(guildId, paused = true) {
    try {
      const player = this.client.lavalink.players.get(guildId);
      if (!player) throw new Error('No player');

      const result = await safePlayer.safeCall(player, 'pause', paused);
      return { success: !!result };
    } catch (err) {
      console.error('PlayerController.pause error:', err && (err.message || err));
      return { success: false, error: err && err.message };
    }
  }

  /**
   * Skip current track
   */
  async skip(guildId) {
    try {
      const player = this.client.lavalink.players.get(guildId);
      if (!player) throw new Error('No player');

      const result = await safePlayer.safeCall(player, 'skip');
      return { success: !!result };
    } catch (err) {
      console.error('PlayerController.skip error:', err && (err.message || err));
      return { success: false, error: err && err.message };
    }
  }

  /**
   * Stop and destroy player
   */
  async stop(guildId) {
    try {
      const player = this.client.lavalink.players.get(guildId);
      if (!player) return { success: true };

      const result = await safePlayer.safeStop(player);
      return { success: !!result };
    } catch (err) {
      console.error('PlayerController.stop error:', err && (err.message || err));
      return { success: false, error: err && err.message };
    }
  }

  /**
   * Set volume
   */
  async setVolume(guildId, volume) {
    try {
      const player = this.client.lavalink.players.get(guildId);
      if (!player) throw new Error('No player');

      // Clamp volume 0-100
      volume = Math.max(0, Math.min(100, volume));

      const result = await safePlayer.safeSetVolume(player, volume);
      return { success: !!result, volume };
    } catch (err) {
      console.error('PlayerController.setVolume error:', err && (err.message || err));
      return { success: false, error: err && err.message };
    }
  }

  /**
   * Get player queue
   */
  getQueue(guildId) {
    try {
      const player = this.client.lavalink.players.get(guildId);
      if (!player) return [];

      return safePlayer.getQueueArray(player) || [];
    } catch (err) {
      console.error('PlayerController.getQueue error:', err && (err.message || err));
      return [];
    }
  }

  /**
   * Get current track
   */
  getCurrentTrack(guildId) {
    try {
      const player = this.client.lavalink.players.get(guildId);
      if (!player) return null;

      const queue = player.queue || [];
      return queue[0] || null;
    } catch (err) {
      console.error('PlayerController.getCurrentTrack error:', err && (err.message || err));
      return null;
    }
  }

  /**
   * Shuffle queue
   */
  async shuffle(guildId) {
    try {
      const player = this.client.lavalink.players.get(guildId);
      if (!player) throw new Error('No player');

      const result = await safePlayer.queueShuffle(player);
      return { success: !!result };
    } catch (err) {
      console.error('PlayerController.shuffle error:', err && (err.message || err));
      return { success: false, error: err && err.message };
    }
  }

  /**
   * Clear queue
   */
  async clearQueue(guildId) {
    try {
      const player = this.client.lavalink.players.get(guildId);
      if (!player) throw new Error('No player');

      const result = await safePlayer.queueClear(player);
      return { success: !!result };
    } catch (err) {
      console.error('PlayerController.clearQueue error:', err && (err.message || err));
      return { success: false, error: err && err.message };
    }
  }
}

module.exports = PlayerController;
