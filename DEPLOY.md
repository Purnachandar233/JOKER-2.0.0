Deployment and Discord Verification

Prerequisites
- Node.js >= 20
- A Discord application with the Bot added

Environment
1. Copy `.env.example` to `.env` and fill in values.
2. Rotate the bot token immediately if it was ever committed.

Enable Privileged Intents
- In the Discord Developer Portal -> Your Application -> Bot: enable
  - Server Members Intent
  - Message Content Intent

Verification
- Discord requires verification when your bot is in 100+ guilds. Submit verification in the Developer Portal.
- Be prepared to provide a description of how privileged intents are used and screenshots of the bot in action.

Run locally
```bash
npm install
node src/bot.js
```

Deployment tips
- Store secrets in environment variables or a secrets manager; do NOT commit `.env`.
- Use a process manager (PM2, systemd) for production.
- If sharding, ensure TOTAL_SHARDS and spawn logic matches gateway recommendations.

Security actions performed
- Removed hard-coded token and DB URI from `config.json` and sanitized `.env`.
- Ensure you rotate the bot token, DB password, and any webhook URLs immediately.

If you want, I can:
- Run a linter/static scan for runtime issues.
- Add a sample `pm2` process file or GitHub Actions workflow for deployment.
