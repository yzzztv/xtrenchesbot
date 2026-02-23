-- XTRENCHESBOT Database Schema
-- Run this in Supabase SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    wallet_address VARCHAR(64) NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    pin_hash VARCHAR(128),
    auto_tp_enabled BOOLEAN DEFAULT false,
    auto_sl_enabled BOOLEAN DEFAULT false,
    autobuy_enabled BOOLEAN DEFAULT false,
    autobuy_score_threshold INTEGER DEFAULT 70,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_address VARCHAR(64) NOT NULL,
    entry_price DECIMAL(28, 18) NOT NULL,
    amount_sol DECIMAL(18, 9) NOT NULL,
    token_amount DECIMAL(28, 0) NOT NULL,
    status VARCHAR(16) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    exit_price DECIMAL(28, 18),
    pnl_sol DECIMAL(18, 9),
    pnl_percent DECIMAL(10, 4)
);

-- Rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trade_count INTEGER DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_token_address ON trades(token_address);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id);
