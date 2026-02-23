-- XTRENCHESBOT Wallet Extension Schema
-- Run this in Supabase SQL Editor AFTER initial schema

-- Wallets table (multi-wallet support)
CREATE TABLE IF NOT EXISTS wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_private_key TEXT NOT NULL,
    public_key VARCHAR(64) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_public_key ON wallets(public_key);
CREATE INDEX IF NOT EXISTS idx_wallets_is_active ON wallets(user_id, is_active) WHERE is_active = true;

-- Ensure only one active wallet per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_one_active_per_user 
ON wallets(user_id) WHERE is_active = true;
