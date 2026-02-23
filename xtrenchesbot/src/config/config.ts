// Config - All numeric values centralized here
// CRITICAL: Import these values where needed. DO NOT hardcode elsewhere.

export const CONFIG = {
  // Trading limits
  MIN_DEPOSIT_SOL: 0.1,
  MIN_TRADE_BALANCE: 0.1,
  MIN_BUY_AMOUNT: 0.05,
  
  // Auto TP/SL defaults
  DEFAULT_TP_PERCENT: 80,
  DEFAULT_SL_PERCENT: -25,
  
  // Rate limiting
  MAX_TRADES_PER_MINUTE: 5,
  RATE_LIMIT_WINDOW_MS: 60000,
  
  // Slippage
  DEFAULT_SLIPPAGE: 20,
  MAX_SLIPPAGE: 50,
  
  // Polling interval for TP/SL (ms)
  TP_SL_POLL_INTERVAL: 15000,
  
  // Closed beta
  MAX_USERS: 20,
  FEE_PERCENT: 0,
  
  // SOL mint address
  SOL_MINT: 'So11111111111111111111111111111111111111112',
  
  // Retry config
  MAX_RPC_RETRIES: 2,
  RPC_RETRY_DELAY_MS: 1000,
} as const;

export type Config = typeof CONFIG;
