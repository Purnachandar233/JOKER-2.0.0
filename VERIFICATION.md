# Verification Artifacts

Use this document when preparing your Discord verification submission.

- Privacy policy URL: (host `PRIVACY.md` publicly and paste URL here)
- Support contact: Provide an email address or invite link to a support server
- Bot intents requested: `GUILD_MEMBERS` (if needed), `MESSAGE_CONTENT` (only if required)

Explanation of intents and data usage:

- `GUILD_MEMBERS`: Used only to manage roles and welcome/autojoin features for 24/7 voice reconnect. We do not store member messages or private DMs.
- `MESSAGE_CONTENT`: Only requested if legacy prefix message commands are used; migrating to slash commands is recommended to avoid this intent.

Data stored in MongoDB:

- Guild settings (prefix, embed color, configured Lavalink nodes)
- Guild filter toggles and small playback metadata (lastTrack identifier) used to provide a consistent user experience.

Security measures:

- All logs sent to webhooks are sanitized to remove tokens, database URIs, emails and other secrets.
- Environment variables (tokens, DB URIs) are never logged in plaintext by default.

Required assets for verification:

1. Privacy policy URL (see above).
2. Support email or Discord invite.
3. A short explanation for each privileged intent requested and why it is necessary.

Optional helpful items:

- Screenshots or a short video demonstrating the bot's functionality.
- A hosted page showing how users can opt out or request data deletion.
