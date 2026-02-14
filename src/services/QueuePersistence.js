/**
 * Queue Persistence - Saves and restores queue on restart
 * Prevents music data loss
 */

const fs = require('fs').promises;
const path = require('path');
const safePlayer = require('../utils/safePlayer');

const QUEUE_DIR = path.join(__dirname, '../..', 'data', 'queues');

class QueuePersistence {
  constructor(client) {
    this.client = client;
  }

  /**
   * Initialize queue directory
   */
  async initialize() {
    try {
      await fs.mkdir(QUEUE_DIR, { recursive: true });
      console.log('QueuePersistence: Initialized');
    } catch (err) {
      console.error('QueuePersistence.initialize error:', err && (err.message || err));
    }
  }

  /**
   * Save queue for guild
   */
  async saveQueue(guildId) {
    try {
      if (!this.client.lavalink) return false;

      const player = this.client.lavalink.players.get(guildId);
      if (!player) return false;

      const queueData = {
        guildId,
        saved: Date.now(),
        queue: player.queue || [],
        currentTrack: player.queue?.[0] || null,
        voiceChannelId: player.voiceChannelId,
        textChannelId: player.textChannelId,
        isPlaying: player.playing || false,
        volume: player.volume || 100,
        position: player.position || 0
      };

      const filePath = path.join(QUEUE_DIR, `${guildId}.json`);
      await fs.writeFile(filePath, JSON.stringify(queueData, null, 2), 'utf-8');

      return true;
    } catch (err) {
      console.error(`QueuePersistence.saveQueue(${guildId}) error:`, err && (err.message || err));
      return false;
    }
  }

  /**
   * Save all active queues
   */
  async saveAllQueues() {
    try {
      if (!this.client.lavalink) return 0;

      const players = this.client.lavalink.players || [];
      let saved = 0;

      for (const [guildId] of players) {
        if (await this.saveQueue(guildId)) {
          saved++;
        }
      }

      console.log(`QueuePersistence: Saved ${saved} queues`);
      return saved;
    } catch (err) {
      console.error('QueuePersistence.saveAllQueues error:', err && (err.message || err));
      return 0;
    }
  }

  /**
   * Load queue for guild
   */
  async loadQueue(guildId) {
    try {
      const filePath = path.join(QUEUE_DIR, `${guildId}.json`);

      const data = await fs.readFile(filePath, 'utf-8');
      const queueData = JSON.parse(data);

      // Check if queue is fresh (less than 7 days old)
      const ageMs = Date.now() - queueData.saved;
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (ageMs > maxAgeMs) {
        console.log(`QueuePersistence: Queue for ${guildId} is too old, discarding`);
        await this.deleteQueue(guildId);
        return null;
      }

      return queueData;
    } catch (err) {
      // File not found or parsing error - return null silently
      return null;
    }
  }

  /**
   * Restore queue to player
   */
  async restoreQueue(guildId, player) {
    try {
      if (!player) return false;

      const queueData = await this.loadQueue(guildId);
      if (!queueData || !queueData.queue || queueData.queue.length === 0) {
        return false;
      }

      console.log(`QueuePersistence: Restoring ${queueData.queue.length} tracks for guild ${guildId}...`);

      // Add tracks to queue
      for (const track of queueData.queue) {
        if (track) {
          await player.queue.add(track).catch(() => {});
        }
      }

      // Restore volume
      if (queueData.volume) {
        await safePlayer.safeSetVolume(player, queueData.volume);
      }

      // Resume playing if was playing
      if (queueData.isPlaying && player.queue.length > 0) {
        await player.play().catch(() => {});
      }

      // Clean up saved file
      await this.deleteQueue(guildId);

      return true;
    } catch (err) {
      console.error(`QueuePersistence.restoreQueue(${guildId}) error:`, err && (err.message || err));
      return false;
    }
  }

  /**
   * Delete saved queue
   */
  async deleteQueue(guildId) {
    try {
      const filePath = path.join(QUEUE_DIR, `${guildId}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (err) {
      // Silently fail if file doesn't exist
      return false;
    }
  }

  /**
   * Get list of all saved queues
   */
  async getSavedQueues() {
    try {
      const files = await fs.readdir(QUEUE_DIR);
      return files.map(f => f.replace('.json', ''));
    } catch (err) {
      return [];
    }
  }

  /**
   * Clean up old queue files (over 7 days)
   */
  async cleanup() {
    try {
      const files = await fs.readdir(QUEUE_DIR);
      let cleaned = 0;

      for (const file of files) {
        try {
          const filePath = path.join(QUEUE_DIR, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const queueData = JSON.parse(data);

          const ageMs = Date.now() - queueData.saved;
          const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days

          if (ageMs > maxAgeMs) {
            await fs.unlink(filePath);
            cleaned++;
          }
        } catch (err) {
          // Skip file if error
        }
      }

      if (cleaned > 0) {
        console.log(`QueuePersistence: Cleaned up ${cleaned} old queue files`);
      }
    } catch (err) {
      console.error('QueuePersistence.cleanup error:', err && (err.message || err));
    }
  }
}

module.exports = QueuePersistence;
