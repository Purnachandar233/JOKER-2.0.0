/**
 * TimeoutManager - Centralized timeout tracking and cleanup
 * Prevents memory leaks from forgotten timers
 */

class TimeoutManager {
  constructor() {
    this.timers = new Map();
    this.nextId = 0;
  }

  /**
   * Create a tracked timeout
   * @param {Function} callback - Function to execute
   * @param {number} ms - Milliseconds to wait
   * @param {string} label - Optional label for debugging
   * @returns {number} Timer ID
   */
  setTimeout(callback, ms, label = 'unknown') {
    const id = this.nextId++;
    const timer = setTimeout(() => {
      try {
        callback();
      } catch (err) {
        console.error(`TimeoutManager callback error (${label}):`, err);
      } finally {
        this.timers.delete(id);
      }
    }, ms);

    this.timers.set(id, { timer, label, createdAt: Date.now(), ms });
    return id;
  }

  /**
   * Create a tracked interval
   * @param {Function} callback - Function to execute
   * @param {number} ms - Milliseconds between executions
   * @param {string} label - Optional label for debugging
   * @returns {number} Timer ID
   */
  setInterval(callback, ms, label = 'unknown') {
    const id = this.nextId++;
    const timer = setInterval(() => {
      try {
        callback();
      } catch (err) {
        console.error(`TimeoutManager interval error (${label}):`, err);
      }
    }, ms);

    this.timers.set(id, { timer, label, isInterval: true, createdAt: Date.now(), ms });
    return id;
  }

  /**
   * Clear a single timer
   * @param {number} id - Timer ID
   * @returns {boolean} Success
   */
  clear(id) {
    const entry = this.timers.get(id);
    if (!entry) return false;

    try {
      if (entry.isInterval) {
        clearInterval(entry.timer);
      } else {
        clearTimeout(entry.timer);
      }
    } catch (err) {
      console.error(`TimeoutManager clear error for ${entry.label}:`, err);
    }

    this.timers.delete(id);
    return true;
  }

  /**
   * Clear all timers matching a label pattern
   * @param {string|RegExp} pattern - Label pattern to match
   * @returns {number} Count of cleared timers
   */
  clearByLabel(pattern) {
    let count = 0;
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

    for (const [id, entry] of this.timers.entries()) {
      if (regex.test(entry.label)) {
        this.clear(id);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all timers
   * @returns {number} Count of cleared timers
   */
  clearAll() {
    let count = 0;
    for (const id of this.timers.keys()) {
      if (this.clear(id)) count++;
    }
    return count;
  }

  /**
   * Get active timer count
   * @returns {number} Number of active timers
   */
  count() {
    return this.timers.size;
  }

  /**
   * Get timer stats (for debugging)
   * @returns {object} Stats object
   */
  getStats() {
    const stats = {
      total: this.timers.size,
      timeouts: 0,
      intervals: 0,
      oldestMs: 0
    };

    let oldestTime = Infinity;

    for (const entry of this.timers.values()) {
      if (entry.isInterval) {
        stats.intervals++;
      } else {
        stats.timeouts++;
      }

      const age = Date.now() - entry.createdAt;
      if (age < oldestTime) {
        oldestTime = age;
      }
    }

    if (oldestTime !== Infinity) {
      stats.oldestMs = Date.now() - oldestTime;
    }

    return stats;
  }

  /**
   * Log all active timers (for debugging)
   */
  logActive() {
    console.log(`[TimeoutManager] Active timers: ${this.timers.size}`);
    for (const [id, entry] of this.timers.entries()) {
      const age = Date.now() - entry.createdAt;
      console.log(`  ID=${id} Label="${entry.label}" Age=${age}ms Type=${entry.isInterval ? 'interval' : 'timeout'}`);
    }
  }
}

// Singleton instance
let sharedInstance = null;

function getTimeoutManager() {
  if (!sharedInstance) {
    sharedInstance = new TimeoutManager();
  }
  return sharedInstance;
}

module.exports = {
  TimeoutManager,
  getTimeoutManager
};
