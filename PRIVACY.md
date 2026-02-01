# Privacy Policy (Draft)

This is a short, clear privacy policy draft to use for Discord verification. Host this page publicly and provide the URL in the Developer Portal.

1. Data Controller
- Owner / Contact: see support contact in VERIFICATION.md

2. What we collect
- Discord IDs and usernames: to identify requesters for commands and permissions.
- Guild IDs and basic guild settings (prefix, filters): stored in MongoDB to restore state.
- Optional data: logs and error reports (sanitized) if webhook/error reporting is enabled.

3. How we use data
- Provide bot features (music playback state, filters, premium features).
- Persist minimal configuration per guild (no message history, no private DMs retained except explicit logs which are sanitized).

4. Third parties
- We use third-party services (Top.gg, Lavalink, Spotify metadata services). We do not share private user messages with Third Parties.

5. Storage & retention
- Data is stored in MongoDB. We retain guild settings until they are deleted explicitly.

6. Security
- We sanitize logs before forwarding to webhooks to avoid leaking tokens or credentials.

7. Contact
- Add a support email or Discord server link in `VERIFICATION.md` and on the hosted privacy page.

---

This file is a template — update the owner contact, data retention policy, and hosting URL before submission.
