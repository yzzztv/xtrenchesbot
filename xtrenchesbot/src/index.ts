import { initDatabase, closeDatabase } from './database';
import { startBot, stopBot, notifyUser } from './bot';
import { startTpSlMonitor, stopTpSlMonitor } from './trading';

// Global error handler
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error.message);
  console.error(error.stack);
  // Don't exit - keep running if possible
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection at:', promise);
  console.error('[ERROR] Reason:', reason);
  // Don't exit - keep running if possible
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('\n[System] Shutting down...');
  
  stopTpSlMonitor();
  stopBot();
  await closeDatabase();
  
  console.log('[System] Goodbye.');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Main entry point
async function main(): Promise<void> {
  console.log('================================');
  console.log('    XTRENCHESBOT');
  console.log('    Solana Meme Warfare Terminal');
  console.log('================================');
  console.log('');
  
  // Initialize database
  console.log('[System] Connecting to database...');
  await initDatabase();
  
  // Start bot
  console.log('[System] Starting bot...');
  await startBot();
  
  // Start TP/SL monitor
  console.log('[System] Starting TP/SL monitor...');
  startTpSlMonitor(notifyUser);
  
  console.log('');
  console.log('[System] Bot is running.');
  console.log('[System] Press Ctrl+C to stop.');
  console.log('');
}

// Run
main().catch((error) => {
  console.error('[FATAL] Startup failed:', error.message);
  process.exit(1);
});
