export { initDatabase, getPool, closeDatabase } from './connection';
export { findUserByTelegramId, createUser, updateUserPin, updateUserSettings, getUserCount, type User } from './userRepository';
export { createTrade, getOpenTrades, getAllOpenTrades, getTradeByToken, closeTrade, getClosedTrades, getTradeById, createPosition, hasActivePosition, type Trade } from './tradeRepository';
export { checkRateLimit, getRemainingTrades } from './rateLimitRepository';
export { 
  getUserWallets, 
  getActiveWallet, 
  getWalletById, 
  getWalletCount, 
  canAddWallet, 
  createWallet, 
  setActiveWallet, 
  deleteWallet, 
  migrateUserWallet,
  MAX_WALLETS_PER_USER,
  type Wallet 
} from './walletRepository';
