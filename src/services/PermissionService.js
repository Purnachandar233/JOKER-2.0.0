/**
 * Centralized Permission Service
 * All permission checks go through here
 */

const { PermissionFlagsBits } = require('discord.js');

class PermissionService {
  constructor(client) {
    this.client = client;
    // Simple cache: userId -> {isPremium: bool, expires: timestamp}
    this.premiumCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // Cache for 5 minutes
  }

  /**
   * Check if user has permission
   */
  hasPermission(member, permission) {
    if (!member) return false;
    if (member.permissions.has(permission)) return true;
    return false;
  }

  /**
   * Check if user is admin
   */
  isAdmin(member) {
    return this.hasPermission(member, PermissionFlagsBits.Administrator);
  }

  /**
   * Check if user is moderator (manage guild or manage messages)
   */
  isModerator(member) {
    return (
      this.hasPermission(member, PermissionFlagsBits.ManageGuild) ||
      this.hasPermission(member, PermissionFlagsBits.ManageMessages)
    );
  }

  /**
   * Check role hierarchy - user1 can manage user2?
   */
  canManageUser(user1Member, user2Member) {
    if (!user1Member || !user2Member) return false;

    // Owners can manage everyone
    if (user1Member.guild.ownerId === user1Member.user.id) return true;

    // Check role hierarchy
    return user1Member.roles.highest.comparePositionTo(user2Member.roles.highest) > 0;
  }

  /**
   * Check if user is bot owner
   */
  isBotOwner(userId) {
    return userId === this.client.config.ownerId;
  }

  /**
   * Check if user is premium (cached)
   */
  async isPremium(userId) {
    try {
      // Check cache first
      const cached = this.premiumCache.get(userId);
      if (cached && cached.expires > Date.now()) {
        return cached.isPremium;
      }

      const Premium = require('../schema/premium-user');
      const premium = await Premium.findOne({ userID: userId }).select('userID').lean();
      const isPremium = !!premium;

      // Cache result
      this.premiumCache.set(userId, {
        isPremium,
        expires: Date.now() + this.cacheTTL
      });

      return isPremium;
    } catch (err) {
      console.error('PermissionService.isPremium error:', err && (err.message || err));
      return false;
    }
  }

  /**
   * Check if guild is premium (cached)
   */
  async isGuildPremium(guildId) {
    try {
      // Check cache first (same TTL)
      const cached = this.premiumCache.get(`guild_${guildId}`);
      if (cached && cached.expires > Date.now()) {
        return cached.isPremium;
      }

      const Premium = require('../schema/Premium');
      const premium = await Premium.findOne({ guildID: guildId }).select('guildID').lean();
      const isPremium = !!premium;

      // Cache result
      this.premiumCache.set(`guild_${guildId}`, {
        isPremium,
        expires: Date.now() + this.cacheTTL
      });

      return isPremium;
    } catch (err) {
      console.error('PermissionService.isGuildPremium error:', err && (err.message || err));
      return false;
    }
  }

  /**
   * Check if user can use DJ commands
   */
  async canUseDJ(member, guildId) {
    // Admin/moderator always can
    if (this.isAdmin(member) || this.isModerator(member)) return true;

    // Check for DJ role
    try {
      const djSchema = require('../schema/djroleSchema');
      const djRole = await djSchema.findOne({ guildID: guildId });

      if (!djRole) return false; // No DJ role set

      return member.roles.cache.has(djRole.roleID);
    } catch (err) {
      console.error('PermissionService.canUseDJ error:', err && (err.message || err));
      return false;
    }
  }

  /**
   * DM user with error/info
   */
  async notifyUser(userId, message) {
    try {
      const user = await this.client.users.fetch(userId);
      if (user) {
        await user.send(message).catch(() => {});
      }
    } catch (err) {
      console.error('PermissionService.notifyUser error:', err && (err.message || err));
    }
  }

  /**
   * Clean expired cache entries (call periodically)
   */
  cleanCache() {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.premiumCache.entries()) {
      if (value.expires < now) {
        this.premiumCache.delete(key);
        removed++;
      }
    }

    if (removed > 0 && removed > this.premiumCache.size / 2) {
      console.log(`[PermissionService] Cache cleanup: removed ${removed} expired entries`);
    }
  }
}

module.exports = PermissionService;
