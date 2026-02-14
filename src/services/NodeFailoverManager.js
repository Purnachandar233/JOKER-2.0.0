/**
 * Node Failover Manager - Handles Lavalink node failures
 * Automatically switches to backup nodes and attempts recovery
 */

class NodeFailoverManager {
  constructor(client) {
    this.client = client;
    this.nodeHealth = new Map(); // nodeName -> { healthy: bool, lastCheck: timestamp, failCount: num }
    this.healthCheckInterval = null;
  }

  /**
   * Initialize health monitoring
   */
  async start() {
    console.log('NodeFailoverManager: Starting health monitoring...');

    // Check node health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkAllNodes();
    }, 30000);

    // Initial check
    await this.checkAllNodes();
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('NodeFailoverManager: Health monitoring stopped');
  }

  /**
   * Check health of all nodes
   */
  async checkAllNodes() {
    try {
      if (!this.client.lavalink || !this.client.lavalink.nodeManager) return;

      const nodes = this.client.lavalink.nodeManager.nodes || [];

      for (const node of nodes) {
        await this.checkNode(node);
      }
    } catch (err) {
      console.error('NodeFailoverManager.checkAllNodes error:', err && (err.message || err));
    }
  }

  /**
   * Check health of single node
   */
  async checkNode(node) {
    try {
      if (!node) return;

      const nodeId = node.id || node.options?.id || 'unknown';
      const isConnected = node.connected || false;
      const isAvailable = node.available || false;

      const currentHealth = {
        healthy: isConnected && isAvailable,
        lastCheck: Date.now(),
        failCount: (this.nodeHealth.get(nodeId)?.failCount || 0)
      };

      // Track failures
      if (!currentHealth.healthy) {
        currentHealth.failCount += 1;
      } else {
        currentHealth.failCount = 0;
      }

      this.nodeHealth.set(nodeId, currentHealth);

      // Log unhealthy nodes
      if (!currentHealth.healthy) {
        console.warn(`NodeFailoverManager: Node ${nodeId} is UNHEALTHY (failures: ${currentHealth.failCount})`);
      }

      // Attempt recovery if too many failures
      if (currentHealth.failCount >= 3) {
        await this.attemptNodeRecovery(node);
      }
    } catch (err) {
      console.error('NodeFailoverManager.checkNode error:', err && (err.message || err));
    }
  }

  /**
   * Attempt to recover a failed node
   */
  async attemptNodeRecovery(node) {
    try {
      const nodeId = node.id || node.options?.id || 'unknown';
      console.log(`NodeFailoverManager: Attempting recovery of node ${nodeId}...`);

      // Try to reconnect
      if (typeof node.reconnect === 'function') {
        await node.reconnect().catch(err => {
          console.error(`NodeFailoverManager: Reconnect failed for ${nodeId}:`, err && (err.message || err));
        });
      }

      // If still unhealthy, migrate players to other nodes
      if (!node.connected) {
        console.log(`NodeFailoverManager: Node ${nodeId} still unhealthy, migrating players...`);
        await this.migratePlayersFromNode(node);
      }
    } catch (err) {
      console.error('NodeFailoverManager.attemptNodeRecovery error:', err && (err.message || err));
    }
  }

  /**
   * Migrate all players from one node to healthy nodes
   */
  async migratePlayersFromNode(failedNode) {
    try {
      if (!this.client.lavalink || !this.client.lavalink.nodeManager) return;

      const healthyNodes = Array.from(this.nodeHealth.values()).filter(h => h.healthy);
      if (healthyNodes.length === 0) {
        console.error('NodeFailoverManager: No healthy nodes available for migration');
        return;
      }

      const players = this.client.lavalink.players || [];
      let migratedCount = 0;

      for (const [guildId, player] of players) {
        try {
          if (player.node && player.node.id === (failedNode.id || failedNode.options?.id)) {
            // Player is on failed node - try to migrate
            console.log(`NodeFailoverManager: Migrating player from guild ${guildId}...`);

            // Store queue before migration
            const queue = player.queue || [];
            const currentTrack = player.queue && player.queue[0] ? player.queue[0] : null;
            const isPlaying = player.playing;

            // Create new player on healthy node
            const healthyNode = this.client.lavalink.nodeManager.nodes?.[0] || failedNode;
            const newPlayer = await this.client.lavalink.createPlayer({
              guildId,
              voiceChannelId: player.voiceChannelId,
              textChannelId: player.textChannelId,
              selfDeafen: true
            }).catch(err => {
              console.error(`NodeFailoverManager: Migration failed for guild ${guildId}:`, err && (err.message || err));
              return null;
            });

            if (newPlayer) {
              // Restore queue
              for (const track of queue) {
                if (track) {
                  await newPlayer.queue.add(track).catch(() => {});
                }
              }

              // Restore playing state
              if (isPlaying) {
                await newPlayer.play().catch(() => {});
              }

              migratedCount++;
            }
          }
        } catch (err) {
          console.error(`NodeFailoverManager: Error migrating guild ${guildId}:`, err && (err.message || err));
        }
      }

      console.log(`NodeFailoverManager: Migrated ${migratedCount} players from failed node`);
    } catch (err) {
      console.error('NodeFailoverManager.migratePlayersFromNode error:', err && (err.message || err));
    }
  }

  /**
   * Get node health report
   */
  getHealthReport() {
    const report = {};
    for (const [nodeId, health] of this.nodeHealth) {
      report[nodeId] = {
        healthy: health.healthy,
        failCount: health.failCount,
        lastCheck: new Date(health.lastCheck).toISOString()
      };
    }
    return report;
  }
}

module.exports = NodeFailoverManager;
