# OptikLink Lavalink Setup

Use [application.yml.example](/c:/Users/vyshn/Desktop/BOTS/JOKER-2.0.0-main/deploy/optiklink-lavalink/application.yml.example) as your Lavalink config template for OptikLink.

What this template is prepared for:
- Spotify links, playlists, albums, and search through `LavaSrc`
- Apple Music can be enabled later through `LavaSrc`
- Deezer direct playback through `LavaSrc`
- SoundCloud and Bandcamp through core Lavalink sources
- Lavalink filters enabled

Before you start:
- Install Java 17+ on the Lavalink server
- Download `Lavalink.jar`
- Put your final config file next to `Lavalink.jar` and name it `application.yml`
- This template is pinned to `lavasrc-plugin:4.8.1`

Required values to fill in:
- `CHANGE_THIS_LAVALINK_PASSWORD`
- `PUT_SPOTIFY_CLIENT_ID_HERE`
- `PUT_SPOTIFY_CLIENT_SECRET_HERE`
- `PUT_DEEZER_ARL_COOKIE_HERE`
- `PUT_DEEZER_MASTER_DECRYPTION_KEY_HERE`

Important source note:
- In this template, Spotify and Apple Music use a Deezer-first provider chain for mirrored playback
- If you do not have working Deezer credentials, disable Deezer and switch to a different fallback provider strategy before using Spotify or Apple Music playback
- Apple Music is disabled by default in this template so Lavalink boots cleanly without an Apple Music JWT token
- Only enable Apple Music after you add a real `mediaAPIToken` that has 3 JWT parts separated by `.`

Bot-side values to update after Lavalink is live:
- In your bot `.env` or `config.json`, set the Lavalink host to your OptikLink server IP
- Set the Lavalink port to `2333`
- Set the Lavalink password to the same value as `CHANGE_THIS_LAVALINK_PASSWORD`

Recommended for your bot:
- Keep YouTube disabled here, because your current bot code intentionally blocks YouTube URLs
- Use OptikLink for Lavalink only if possible, and keep the Discord bot on a separate host for better stability
