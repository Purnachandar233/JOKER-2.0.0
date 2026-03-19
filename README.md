# Joker Music Bot

## Overview

Joker Music Bot is a Discord music bot built with Discord.js v14 that connects to Lavalink servers via `lavalink-client` for high-quality audio streaming. The bot supports multiple music sources including Spotify, Soundcloud, and YouTube, with features like audio filters, DJ role system, premium/vote-gated commands, playlist management, and 24/7 voice channel presence. It uses `discord-hybrid-sharding` for horizontal scaling across multiple clusters.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Framework
- **Runtime**: Node.js v20+
- **Discord Library**: Discord.js v14 with hybrid sharding via discord-hybrid-sharding
- **Audio System**: Lavalink server connection through `lavalink-client`
- **Entry Point**: `cluster.js` spawns sharded bot processes from `src/bot.js`

### Command Structure
- Commands organized by category in `src/commands/` subdirectories:
  - `filters/` - Audio effect commands (8d, bassboost, nightcore, etc.)
  - `general/` - Utility commands (help, info, ping, stats)
  - `music/` - Playback commands (play, queue, skip, loop)
  - `owner/` - Bot administration commands
  - `settings/` - Server configuration commands
  - `playlists/` - User playlist management

### Data Models (MongoDB via Mongoose)
Located in `src/schema/`:
- `User.js` - User profiles with badge system
- `prefix.js` - Per-guild custom prefixes
- `premium-user.js` / `premium-guild.js` - Premium subscriptions with expiry
- `djroleSchema.js` - DJ role configuration per guild
- `playlists.js` - User-created playlists
- `twentyfourseven.js` - 24/7 voice channel persistence
- `blacklistSchema.js` - Banned users
- `npSchema.js` - Now-playing message toggle
- `defaultvolumeSchema.js` - Default volume per guild

### Permission System
- DJ-only commands require specific role or MANAGE_MESSAGES permission
- Vote-locked commands require Top.gg vote verification
- Premium commands gated behind subscription or vote status
- Owner commands restricted to bot administrators

### Sharding Architecture
- Uses `discord-hybrid-sharding` ClusterManager
- Auto-calculated shard count with 2 shards per cluster
- Process mode for cluster isolation
- Cross-cluster communication for aggregate stats

## External Dependencies

### Required Services
- **MongoDB**: Primary database for all persistent data (connection string in config.json)
- **Lavalink Server**: Audio streaming server (configured in config.json nodes array with host, port, password)
- **Discord Bot Token**: Bot authentication

### Third-Party APIs
- **Top.gg API**: Vote verification and bot statistics posting via `@top-gg/sdk` and `topgg-autoposter`
- **Spotify API**: Track/playlist resolution via `spotify-url-info` and Lavalink searches
- **Apple Music**: Track resolution via `better-erela.js-apple`

### Configuration
Configuration is managed through environment variables (secrets):
- `TOKEN`: Discord bot token (required)
- `MONGOURL`: MongoDB connection string (optional but recommended for full features)

Default settings in `config.json`:
- `embedColor`: Embed color for bot messages
- `prefix`: Default command prefix (=)
- `nodes`: Lavalink audio server configuration

## Running the Bot
The bot runs as a console application using `npm start`. Configure your Discord bot token in secrets before starting.