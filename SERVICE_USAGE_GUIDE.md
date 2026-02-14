# Service Layer Usage Guide

This guide shows how to use all 11 integrated services in your slash commands.

## 1. CommandErrorHandler - Global Error Wrapper

**Problem it solves:** Without this, errors crash the bot and never notify users.

**Usage in commands:**

```javascript
module.exports = {
  name: "mycommand",
  run: async (client, interaction) => {
    // Wrap entire command execution
    return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
      // Your command logic here
      const result = await doSomething();
      await interaction.editReply({ content: "Success!" });
    });
  }
};
```

**What it does:**
- Catches all errors automatically
- Sends user-facing error embeds (hides internals)
- Logs error with ID to console/files
- Notifies bot owner of critical errors
- Returns `{success: true, duration: 123}` or `{error: "message", errorId: "xyz"}`

---

## 2. MusicChecks - Reusable Validation

**Problem it solves:** Every music command has the same validation code (copy-paste mess).

**Usage in music commands:**

```javascript
const musicChecks = require('../../utils/musicChecks');

module.exports = {
  name: "play",
  run: async (client, interaction) => {
    return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
      // Run all checks at once
      const check = await musicChecks.runMusicChecks(client, interaction, {
        inVoiceChannel: true,
        botInVoiceChannel: true,
        sameChannel: true,
        requirePlayer: false  // Only if command needs existing player
      });

      // Check returned: { valid: boolean, embed?: EmbedBuilder, player?: Player, channel?: VoiceChannel }
      if (!check.valid) {
        return await interaction.editReply({ embeds: [check.embed] });
      }

      // Now you know checks passed - proceed with music logic
      const player = check.player;
      const voiceChannel = check.channel;
      
      // ... rest of command
    });
  }
};
```

**Available checks:**
- `checkInVoiceChannel()` - User is in voice channel
- `checkBotInVoiceChannel()` - Bot is in voice channel
- `checkSameVoiceChannel()` - User and bot in same channel
- `checkPlayer()` - Player exists for guild
- `checkQueue()` - Queue has tracks
- `runMusicChecks()` - All 5 at once with options

---

## 3. CooldownManager - Spam Prevention

**Problem it solves:** Users spam commands faster than they should.

**Usage in ANY command:**

```javascript
module.exports = {
  name: "mycommand",
  run: async (client, interaction) => {
    return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
      // Check cooldown (5 second default)
      const cooldownCheck = client.cooldownManager.check("mycommand", interaction.user.id);
      
      if (cooldownCheck.onCooldown) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setDescription(`⏱️ Cooldown active. Try again in **${cooldownCheck.remaining()}ms**`);
        return await interaction.editReply({ embeds: [embed] });
      }

      // Set cooldown for this user after executing
      client.cooldownManager.set("mycommand", interaction.user.id, 5000); // 5 second cooldown

      // Execute command
      await interaction.editReply({ content: "Success!" });
    });
  }
};
```

**Methods:**
- `check(commandName, userId)` → `{onCooldown, remaining()}`
- `set(commandName, userId, durationMs)` → sets cooldown
- `getRemaining(commandName, userId)` → seconds left
- `clearUser/Command/All()` → admin reset

---

## 4. PermissionService - Centralized Auth

**Problem it solves:** Permission checks scattered everywhere, inconsistent.

**Usage in admin/DJ commands:**

```javascript
module.exports = {
  name: "admincommand",
  run: async (client, interaction) => {
    return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
      // Check if user is admin
      const isAdmin = await client.permissionService.isAdmin(interaction.member);
      if (!isAdmin) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setDescription('❌ You need admin permissions for this command.');
        return await interaction.editReply({ embeds: [embed] });
      }

      // Check if DJ role is set for guild
      const isDJ = await client.permissionService.canUseDJ(interaction.member, interaction.guildId);
      
      // Check if user is premium
      const isPremium = await client.permissionService.isPremium(interaction.user.id);
      
      // Check if bot owner
      const isOwner = await client.permissionService.isBotOwner(interaction.user.id);

      // ... rest of command
    });
  }
};
```

**Available methods:**
- `hasPermission(member, flag)` - Generic flag check
- `isAdmin(member)` - Server admin
- `isModerator(member)` - Moderator role
- `isBotOwner(userId)` - Bot owner from config
- `canManageUser(member, targetMember)` - Can manage user
- `isPremium(userId)` - User has premium
- `isGuildPremium(guildId)` - Guild has premium
- `canUseDJ(member, guildId)` - Can use DJ commands
- `notifyUser(userId, message)` - Send user DM

---

## 5. PlayerController - Thread-Safe Music Control

**Problem it solves:** Race conditions when multiple users skip/pause/play simultaneously.

**Usage in music commands (REPLACES direct player access):**

```javascript
module.exports = {
  name: "play",
  run: async (client, interaction) => {
    return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
      // DON'T DO THIS ANYMORE:
      // const player = client.lavalink.players.get(guildId);
      // player.play();  // RACE CONDITION!

      // DO THIS INSTEAD:
      const result = await client.playerController.playTracks(
        interaction.guildId,
        tracksArray,
        { 
          voiceChannelId: interaction.member.voice.channelId,
          textChannelId: interaction.channelId
        }
      );

      if (!result.success) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setDescription(`❌ ${result.error}`);
        return await interaction.editReply({ embeds: [embed] });
      }

      await interaction.editReply({ content: `▶️ Now playing: **${result.currentTrack?.title}**` });
    });
  }
};
```

**Available PlayerController methods:**
- `getOrCreatePlayer(guildId, channelId, textChannelId)` - Get or create
- `playTracks(guildId, tracks, options)` - Play list of tracks
- `pause(guildId)` → `{success, paused}`
- `skip(guildId)` → `{success, newTrack}`
- `stop(guildId)` → `{success}`
- `shuffle(guildId)` → `{success, shuffled}`
- `clearQueue(guildId)` → `{success, clearedCount}`
- `setVolume(guildId, volume)` → `{success}`
- `getQueue(guildId)` → array of tracks
- `getCurrentTrack(guildId)` → current track object

**Why it's better:**
- Uses locks to prevent race conditions
- Always returns `{success, ...data}` for consistent error handling
- Thread-safe - safe for concurrent operations

---

## 6. FilterManager - Centralized Filter State

**Problem it solves:** Multiple filter commands interfere with each other.

**Usage in filter commands:**

```javascript
module.exports = {
  name: "treble",
  run: async (client, interaction) => {
    return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
      // DON'T DO THIS:
      // player.filters.treble = 1.5;  // Might conflict with other filters

      // DO THIS:
      const result = await client.filterManager.applyFilter(
        interaction.guildId,
        'treble',
        { value: 1.5 }  // Pass filter config
      );

      if (!result.success) {
        return await interaction.editReply({ 
          embeds: [new EmbedBuilder().setColor('#ff0000').setDescription(result.error)] 
        });
      }

      await interaction.editReply({ content: '🎵 Treble filter applied!' });
    });
  }
};
```

**Available FilterManager methods:**
- `applyFilter(guildId, filterName, config)` → `{success, error?}`
- `removeFilter(guildId, filterName)` → `{success}`
- `clearFilters(guildId)` → `{success, clearedCount}`
- `getActiveFilters(guildId)` → array of filter names
- `isFilterActive(guildId, filterName)` → boolean
- `resetGuildFilters(guildId)` - Called on bot leave

---

## 7. NodeFailoverManager - Lavalink Health

**Problem it solves:** If a Lavalink node goes down, all music stops forever.

**What it does automatically:**
- ✅ Monitors all Lavalink nodes every 30 seconds
- ✅ Detects node failures after 3 failed health checks
- ✅ Automatically migrates all players to healthy node
- ✅ Saves queue state during migration
- ✅ Restores playback on new node
- ✅ Logs all failures with timestamps

**You don't need to call this** - it runs in background, but you can:

```javascript
// Check node status (in owner commands)
const status = client.nodeFailoverManager.getStatus();
console.log(status);
// { 
//   nodeName: { healthy: true, lastCheck: 1234567, failCount: 0 },
//   ...
// }
```

---

## 8. MongoWatcher - Database Auto-Recovery

**Problem it solves:** MongoDB disconnects = bot can't save/load settings.

**What it does automatically:**
- ✅ Monitors MongoDB connection every 60 seconds
- ✅ Detects disconnects/errors
- ✅ Automatically reconnects with exponential backoff
- ✅ Max 10 reconnection attempts
- ✅ Logs all connection events

**You don't need to call this** - it runs in background, but you can check status:

```javascript
// In monitoring commands
const status = client.mongoWatcher.getStatus();
// {
//   connected: true,
//   readyState: 1,
//   reconnectAttempts: 0,
//   maxAttempts: 10,
//   nextRetryIn: '5m'
// }
```

---

## 9. QueuePersistence - Queue Save/Restore

**Problem it solves:** Bot restart = all queues lost.

**What it does automatically:**
- ✅ Saves all active queues on bot shutdown (SIGINT)
- ✅ Auto-restores queues on bot startup (7-day TTL)
- ✅ Cleans up old queues every 6 hours

**You can manually save/restore:**

```javascript
// Save specific guild's queue
await client.queuePersistence.saveQueue(guildId);

// Get list of saved queues
const saved = await client.queuePersistence.getSavedQueues();
console.log(saved);  // ['123456789', '987654321']

// Restore queue for guild
const queueData = await client.queuePersistence.loadQueue(guildId);

// Delete saved queue
await client.queuePersistence.deleteQueue(guildId);
```

---

## 10. Logger - Structured Logging

**Problem it solves:** No audit trail, poor debugging info.

**Usage throughout code:**

```javascript
// Use instead of console.log/console.error

// Info level (general messages)
client.logger.info('Command executed', { 
  command: 'play', 
  user: userId, 
  duration: '125ms' 
});

// Log commands automatically
client.logger.logCommand('play', userId, guildId, duration, success);

// Log player events
client.logger.logPlayer('trackEnd', guildId, { 
  track: trackTitle, 
  queue: 5 
});

// Log database ops
client.logger.logDatabase('INSERT', 'premiumUsers', { 
  userId, 
  duration: '45ms' 
});

// Warnings (should be fixed)
client.logger.warn('Unusual activity', { 
  user: userId, 
  reason: 'spam_detected' 
});

// Errors
client.logger.error('Failed to fetch track', error, { 
  query: searchTerms 
});

// Fatal (crash-level)
client.logger.fatal('Database connection lost', dbError);

// Get recent logs (for debug command)
const logs = client.logger.getRecentLogs(50);
const errors = client.logger.getRecentErrors(20);
```

**Log files created:**
- `logs/bot-YYYY-MM-DD.log` - All logs for the day
- `logs/error-YYYY-MM-DD.log` - Errors only
- Auto-cleanup: Keeps 30 days, removes older

---

## 11. SafeReply - Interaction State Handling

**Problem it solves:** "Unknown Interaction" errors when replies are late.

**Usage in commands:**

```javascript
const safeReply = require('../../utils/safeReply');

module.exports = {
  name: "mycommand",
  run: async (client, interaction) => {
    // Instead of direct .editReply() which might fail

    if (!interaction.deferred && !interaction.replied) {
      await safeReply.safeDeferReply(interaction);
    }

    // Later, even if 3+ seconds have passed...
    await safeReply.safeReply(interaction, {
      content: "Response after long operation",
      embeds: [embed]
    });

    // Works no matter the state!
  }
};
```

---

## Complete Example Command

Here's what a refactored command looks like using ALL services:

```javascript
const { EmbedBuilder } = require("discord.js");
const musicChecks = require('../../utils/musicChecks');
const safeReply = require('../../utils/safeReply');

module.exports = {
  name: "play",
  description: "Play a song",
  
  run: async (client, interaction) => {
    // 1. Wrap entire command in error handler
    return await client.errorHandler.executeWithErrorHandling(interaction, async (interaction) => {
      
      // 2. Check cooldown before doing anything
      const cooldown = client.cooldownManager.check("play", interaction.user.id);
      if (cooldown.onCooldown) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setDescription(`⏱️ Please wait ${cooldown.remaining()}ms`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      // 3. Run music-specific checks
      const check = await musicChecks.runMusicChecks(client, interaction, {
        inVoiceChannel: true,
        botInVoiceChannel: false,
        sameChannel: false,
        requirePlayer: false
      });

      if (!check.valid) {
        return await safeReply.safeReply(interaction, { embeds: [check.embed] });
      }

      // 4. Check if user has DJ permission for this guild
      const hasDJ = await client.permissionService.canUseDJ(interaction.member, interaction.guildId);
      if (!hasDJ) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setDescription('❌ No DJ permission');
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      // 5. Get query and search
      const query = interaction.options.getString("query");
      const results = await searchTracks(client, query); // Your search function

      if (!results.length) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setDescription('No tracks found');
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      // 6. Use PlayerController (thread-safe) instead of direct player access
      const playResult = await client.playerController.playTracks(
        interaction.guildId,
        results,
        {
          voiceChannelId: interaction.member.voice.channelId,
          textChannelId: interaction.channelId
        }
      );

      if (!playResult.success) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setDescription(`❌ ${playResult.error}`);
        return await safeReply.safeReply(interaction, { embeds: [embed] });
      }

      // 7. Send success response
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`▶️ Now Playing`)
        .setDescription(playResult.currentTrack.title);
      await safeReply.safeReply(interaction, { embeds: [embed] });

      // 8. Set cooldown AFTER success
      client.cooldownManager.set("play", interaction.user.id, 2000);

      // 9. Log the event
      client.logger.logCommand('play', interaction.user.id, interaction.guildId, 0, true);
    });
  }
};
```

---

## Summary: Service Integration Checklist

For each command, use:

- [ ] **CommandErrorHandler** - Wrap in `.executeWithErrorHandling()`
- [ ] **MusicChecks** - Use `runMusicChecks()` for music commands
- [ ] **CooldownManager** - Check + set cooldown
- [ ] **PermissionService** - Check perms before execution
- [ ] **PlayerController** - Use instead of `client.lavalink.players.get()`
- [ ] **FilterManager** - Use in filter commands
- [ ] **SafeReply** - Use for all interactions
- [ ] **Logger** - Log important events

**Result:** Zero crashes, better debugging, consistent error handling, spam protection, race condition prevention! 🚀
