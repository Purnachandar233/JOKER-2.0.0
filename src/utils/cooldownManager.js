/**
 * Cooldown system - prevent command spam
 */

const COOLDOWN_SWEEP_INTERVAL_MS = 60 * 1000;

class CooldownManager {
  constructor() {
    this.cooldowns = new Map(); // Map<commandName, Map<userId, { expiresAt, remaining }>>
    this.sweeper = setInterval(() => {
      this.pruneExpired();
    }, COOLDOWN_SWEEP_INTERVAL_MS);

    if (typeof this.sweeper.unref === 'function') {
      this.sweeper.unref();
    }
  }

  pruneExpired(now = Date.now()) {
    for (const [commandName, cmdCooldowns] of this.cooldowns.entries()) {
      for (const [userId, cooldown] of cmdCooldowns.entries()) {
        if (!cooldown || now >= Number(cooldown.expiresAt || 0)) {
          cmdCooldowns.delete(userId);
        }
      }

      if (cmdCooldowns.size === 0) {
        this.cooldowns.delete(commandName);
      }
    }
  }

  /**
   * Check if user is on cooldown
   * @returns { onCooldown: boolean, remaining: number (ms) }
   */
  check(commandName, userId) {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map());
      return { onCooldown: false, remaining: 0 };
    }

    const cmdCooldowns = this.cooldowns.get(commandName);
    if (!cmdCooldowns.has(userId)) {
      return { onCooldown: false, remaining: 0 };
    }

    const cooldown = cmdCooldowns.get(userId);
    const now = Date.now();

    if (now >= cooldown.expiresAt) {
      cmdCooldowns.delete(userId);
      if (cmdCooldowns.size === 0) {
        this.cooldowns.delete(commandName);
      }
      return { onCooldown: false, remaining: 0 };
    }

    return { onCooldown: true, remaining: cooldown.expiresAt - now };
  }

  /**
   * Set cooldown for user
   * @param commandName - name of command
   * @param userId - user ID
   * @param durationMs - cooldown duration in milliseconds
   */
  set(commandName, userId, durationMs = 3000) {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map());
    }

    const cmdCooldowns = this.cooldowns.get(commandName);
    const expiresAt = Date.now() + durationMs;

    cmdCooldowns.set(userId, { expiresAt, remaining: durationMs });
  }

  /**
   * Get cooldown time in seconds for display
   */
  getRemaining(commandName, userId) {
    const check = this.check(commandName, userId);
    return Math.ceil(check.remaining / 1000);
  }

  /**
   * Clear all cooldowns for a user
   */
  clearUser(userId) {
    for (const [, cmdCooldowns] of this.cooldowns) {
      cmdCooldowns.delete(userId);
    }
  }

  /**
   * Clear all cooldowns for a command
   */
  clearCommand(commandName) {
    if (this.cooldowns.has(commandName)) {
      this.cooldowns.delete(commandName);
    }
  }

  /**
   * Clear all cooldowns
   */
  clearAll() {
    this.cooldowns.clear();
  }

  /**
   * Get cooldown stats for monitoring
   */
  getStats() {
    this.pruneExpired();
    let totalCooldowns = 0;
    for (const [, cmdCooldowns] of this.cooldowns) {
      totalCooldowns += cmdCooldowns.size;
    }
    return {
      commands: this.cooldowns.size,
      totalCooldowns,
      percentUsage: `${((totalCooldowns / (this.cooldowns.size || 1)) * 100).toFixed(2)}%`
    };
  }
}

module.exports = new CooldownManager();
