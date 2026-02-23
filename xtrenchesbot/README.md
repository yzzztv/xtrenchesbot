# XTRENCHESBOT

Solana Meme Warfare Terminal - Custodial Telegram Trading Bot

## Requirements

- Node.js 18+ (LTS)
- PostgreSQL database (Supabase compatible)
- Helius RPC endpoint

## Quick Start

1. **Clone and install:**
```bash
cd xtrenchesbot
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your values
```

3. **Set up database:**
- Create a Supabase project (or use any PostgreSQL)
- Run `schema.sql` in SQL Editor
- Add DATABASE_URL to .env

4. **Build and run:**
```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| BOT_TOKEN | Telegram bot token | Yes |
| HELIUS_RPC | Helius RPC endpoint | Yes |
| DATABASE_URL | PostgreSQL connection string | Yes |
| ENCRYPTION_SECRET | 32+ char encryption key | Yes |
| JUPITER_API | Jupiter API URL | No (default provided) |
| DEXSCREENER_API | Dexscreener API URL | No (default provided) |

## Bot Commands

| Command | Description |
|---------|-------------|
| /start | Register and get wallet |
| /help | Show all commands |
| /balance | Check wallet balance |
| /buy `<CA>` `<SOL>` | Buy token |
| /sell `<CA>` `[%]` | Sell token |
| /positions | View open trades |
| /pnl | Generate PNL card |
| /scan `<CA>` | Analyze token |
| /withdraw `<SOL>` `<addr>` | Withdraw funds |
| /setpin `<4digits>` | Set withdrawal PIN |
| /settings | View settings |
| /tp `on\|off` | Toggle auto TP |
| /sl `on\|off` | Toggle auto SL |

## Deployment

Works on:
- Local machine
- VPS (Ubuntu, Debian, etc.)
- Railway / Render / Fly.io
- Termux Android

### Railway/Render

1. Connect GitHub repo
2. Set environment variables
3. Deploy

### VPS

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <repo>
cd xtrenchesbot
npm install
npm run build

# Run with PM2 (recommended)
npm install -g pm2
pm2 start dist/index.js --name xtrenchesbot
pm2 save
```

### Termux Android

```bash
pkg update && pkg upgrade
pkg install nodejs-lts git
npm install -g npm@latest

cd xtrenchesbot
npm install
npm run build
npm start
```

## Architecture

```
/src
  index.ts          # Entry point
  /bot              # Telegram bot handlers
  /services         # External API integrations
  /trading          # Buy/sell execution
  /wallet           # Solana wallet management
  /scoring          # Token entry scoring
  /database         # PostgreSQL repositories
  /config           # Configuration
  /security         # Encryption/hashing
  /utils            # Utilities
```

## Closed Beta

- Max 20 users
- 0% fee
- No verification

## Security

- Private keys encrypted with AES-256-CBC
- PINs hashed with bcrypt
- Rate limiting enforced
- No secrets logged

## License

MIT
