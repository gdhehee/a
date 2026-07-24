# NOKIATIS Discord Generator Bot

A Discord slash-command bot that generates free and premium accounts from a stock file system, with a web dashboard for management. Ready to deploy on **Render**.

---

## Features

- `/free [service]` — Generate a free account (with optional Linkvertise gate)
- `/premium [service]` — Generate a premium account (premium users only)
- `/stock` — View all service stock counts
- `/create [service] [type]` — Create a new service file (admin)
- `/add [type] [service] [account]` — Add an account to a service (admin)
- `/help` — Show command list
- `/owner adduser / removeuser / listusers` — Manage authorized users (owner only)
- **Web Dashboard** — Login-protected file manager and settings panel

---

## Quick Start (Local)

```bash
cd nokiatis-bot
npm install
cp .env.example .env
# Fill in your values in .env
node deploy-commands.js   # Register slash commands once
npm start                 # Start bot + dashboard
```

Open `http://localhost:3000` to access the dashboard.

---

## Deploy on Render

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New → Web Service**.
3. Connect your GitHub repo and select the `nokiatis-bot` folder as the **Root Directory**.
4. Set **Build Command**: `npm install`  
   Set **Start Command**: `npm start`
5. Add the following **Environment Variables** (in the Render dashboard):

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Your bot token (Discord Developer Portal) |
| `DISCORD_CLIENT_ID` | Your application's Client ID |
| `DISCORD_GUILD_ID` | Your server's Guild ID (for guild-scoped commands) |
| `OWNER_ID` | Your Discord user ID (gives full owner access) |
| `GEN_CHANNEL_ID` | Channel ID where `/free` is allowed |
| `PREMIUM_CHANNEL_ID` | Channel ID where `/premium` is allowed |
| `DASHBOARD_USERNAME` | Dashboard login username |
| `DASHBOARD_PASSWORD` | Dashboard login password |
| `SESSION_SECRET` | A long random string for cookie signing |

> All other variables are optional — see `.env.example` for defaults.

6. Click **Deploy**. Render will install dependencies and start the bot.

> **Note:** Render free-tier instances spin down after inactivity. To keep the bot alive 24/7, upgrade to a paid plan or use an uptime monitor like [UptimeRobot](https://uptimerobot.com) pointing to `https://your-app.onrender.com/healthz`.

---

## First Run Checklist

- [ ] Create a bot at [discord.com/developers](https://discord.com/developers/applications)
- [ ] Enable **Server Members Intent** and **Message Content Intent** (if needed)
- [ ] Invite the bot with `applications.commands` + `bot` scopes and `Send Messages`, `Embed Links`, `Read Message History` permissions
- [ ] Set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `OWNER_ID` in your environment
- [ ] Start the bot — commands register automatically on startup
- [ ] Use `/owner adduser @someone free` to authorize your first users
- [ ] Use `/create steam free` to create your first service, then `/add free steam user:pass` to add an account

---

## Linkvertise (Optional)

To require users to complete a Linkvertise link before receiving an account:
1. Create a publisher account at [linkvertise.com](https://linkvertise.com)
2. Enable anti-bypass in your dashboard and copy your token
3. Set `LINKVERTISE_PUBLISHER_ID` and `LINKVERTISE_ANTI_BYPASS_TOKEN` in your environment

Leave both blank to deliver accounts without any gate.

---

## File Structure

```
nokiatis-bot/
├── index.js              # Bot entry point
├── deploy-commands.js    # Slash command registration
├── server.js             # Express dashboard
├── config.js             # Reads all settings from env vars
├── commands/
│   ├── free.js           # /free command + Linkvertise logic
│   ├── premium.js        # /premium command
│   ├── stock.js          # /stock command
│   ├── create.js         # /create command
│   ├── add.js            # /add command
│   ├── help.js           # /help command
│   └── owner.js          # /owner command (user management)
├── utils/
│   ├── users.js          # JSON-backed user authorization
│   └── linkvertise.js    # Linkvertise anti-bypass API
├── free/                 # Free stock .txt files (one account per line)
├── premium/              # Premium stock .txt files
├── dashboard/            # Dashboard HTML, CSS, JS, and images
├── users.json            # Authorized users (auto-created)
├── .env.example          # All environment variables documented
├── render.yaml           # Render deployment config
└── package.json
```
