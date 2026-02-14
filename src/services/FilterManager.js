/**
 * FilterManager - Centralized music filter management
 * Prevents filter conflicts and reset issues
 */

const safePlayer = require('../utils/safePlayer');

class FilterManager {
  constructor(client) {
    this.client = client;
    this.activeFilters = new Map(); // guildId -> Set<filterName>
  }

  /**
   * Apply filter to player
   */
  async applyFilter(guildId, filterName, filterConfig) {
    try {
      const player = this.client.lavalink.players.get(guildId);
      if (!player) throw new Error('No player');

      // Update player filters
      const filters = player.filters || {};
      filters[filterName] = filterConfig;

      await safePlayer.safeCall(player, 'setFilters', filters);

      // Track active filter
      if (!this.activeFilters.has(guildId)) {
        this.activeFilters.set(guildId, new Set());
      }
      this.activeFilters.get(guildId).add(filterName);

      return { success: true, filter: filterName };
    } catch (err) {
      console.error(`FilterManager.applyFilter(${filterName}) error:`, err && (err.message || err));
      return { success: false, error: err && err.message };
    }
  }

  /**
   * Remove filter from player
   */
  async removeFilter(guildId, filterName) {
    try {
      const player = this.client.lavalink.players.get(guildId);
      if (!player) throw new Error('No player');

      const filters = player.filters || {};
      delete filters[filterName];

      await safePlayer.safeCall(player, 'setFilters', filters);

      // Untrack filter
      if (this.activeFilters.has(guildId)) {
        this.activeFilters.get(guildId).delete(filterName);
      }

      return { success: true };
    } catch (err) {
      console.error(`FilterManager.removeFilter(${filterName}) error:`, err && (err.message || err));
      return { success: false, error: err && err.message };
    }
  }

  /**
   * Clear all filters
   */
  async clearFilters(guildId) {
    try {
      const player = this.client.lavalink.players.get(guildId);
      if (!player) throw new Error('No player');

      await safePlayer.safeCall(player, 'setFilters', {});

      if (this.activeFilters.has(guildId)) {
        this.activeFilters.delete(guildId);
      }

      return { success: true };
    } catch (err) {
      console.error('FilterManager.clearFilters error:', err && (err.message || err));
      return { success: false, error: err && err.message };
    }
  }

  /**
   * Get active filters for guild
   */
  getActiveFilters(guildId) {
    const filters = this.activeFilters.get(guildId) || new Set();
    return Array.from(filters);
  }

  /**
   * Check if filter is active
   */
  isFilterActive(guildId, filterName) {
    const filters = this.activeFilters.get(guildId);
    return filters ? filters.has(filterName) : false;
  }

  /**
   * Reset all filters for guild (usually on leave)
   */
  resetGuildFilters(guildId) {
    if (this.activeFilters.has(guildId)) {
      this.activeFilters.delete(guildId);
    }
  }
}

module.exports = FilterManager;
