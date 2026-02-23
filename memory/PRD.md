# XTRENCHESBOT - Product Requirements Document

## Original Problem Statement
Build a fully functional custodial Solana Telegram trading bot with:
- Real wallet generation and management
- Jupiter swap integration
- Dexscreener/Helius data
- Token entry scoring
- PNL card generation
- Auto TP/SL monitoring
- Rate limiting
- Closed beta (max 20 users)

## Architecture
- **Stack**: Node.js, TypeScript, PostgreSQL, Telegraf, Solana Web3.js
- **External APIs**: Jupiter (swaps), Dexscreener (market data), Helius (RPC, metadata)
- **Security**: AES-256-CBC encryption, bcrypt PIN hashing
- **Database**: PostgreSQL (Supabase compatible)

## User Personas
1. **Degen Trader**: Wants fast meme coin entries with scan/scoring
2. **Position Manager**: Needs PNL tracking and auto TP/SL

## Core Requirements (Static)
- Custodial wallet per user
- /buy, /sell, /scan, /pnl commands
- Auto TP (+80%) and SL (-25%) monitoring
- Rate limiting (5 trades/min)
- PIN-protected withdrawals
- PNL card generation with custom templates

## What's Been Implemented (Feb 2026)
- [x] Complete project structure
- [x] Config system with centralized values
- [x] Database repositories (users, trades, rate_limits)
- [x] Wallet generation and encryption
- [x] Jupiter swap integration
- [x] Dexscreener data fetching
- [x] Helius metadata/holder analysis
- [x] Token entry scoring algorithm
- [x] PNL card generation (node-canvas)
- [x] All bot commands
- [x] TP/SL monitoring (15s polling)
- [x] Rate limiting
- [x] PIN system for withdrawals
- [x] SQL schema for Supabase

## Pending User Input
- DATABASE_URL for Supabase connection

## Prioritized Backlog
### P0 (Blocking)
- User to provide DATABASE_URL

### P1 (High Priority)
- Integration testing with live Telegram
- End-to-end trade execution test
- PNL card visual polish

### P2 (Nice to Have)
- Autobuy based on score threshold
- Multiple open positions per token
- Trade history command
- Referral system

## Next Tasks
1. User provides DATABASE_URL
2. Run schema.sql in Supabase
3. Test bot with real Telegram messages
4. Execute test trade on devnet/mainnet
