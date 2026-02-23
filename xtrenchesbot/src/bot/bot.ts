import { Telegraf, Context } from 'telegraf';
import { env } from '../config';
import { 
  handleStart, 
  handleHelp, 
  handleBalance,
  handleBuy, 
  handleSell, 
  handlePositions,
  handleScan,
  handlePnl,
  handleWithdraw,
  handleSetPin,
  handleSettings,
  handleTp,
  handleSl,
  processWithdrawalPin,
  hasPendingWithdrawal
} from './commands';
import { findUserByTelegramId } from '../database';

let bot: Telegraf | null = null;

/**
 * Initialize and start the bot
 */
export async function startBot(): Promise<Telegraf> {
  bot = new Telegraf(env.BOT_TOKEN);
  
  // Error handler
  bot.catch((err, ctx) => {
    console.error('[Bot] Error:', err);
    ctx.reply('Something went wrong. Try again.').catch(() => {});
  });
  
  // Register commands
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('balance', handleBalance);
  bot.command('buy', handleBuy);
  bot.command('sell', handleSell);
  bot.command('positions', handlePositions);
  bot.command('scan', handleScan);
  bot.command('pnl', handlePnl);
  bot.command('withdraw', handleWithdraw);
  bot.command('setpin', handleSetPin);
  bot.command('settings', handleSettings);
  bot.command('tp', handleTp);
  bot.command('sl', handleSl);
  
  // Handle text messages (for PIN confirmation during withdrawal)
  bot.on('text', async (ctx) => {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;
    
    const text = ctx.message.text;
    
    // Skip if it's a command
    if (text.startsWith('/')) return;
    
    // Check for pending withdrawal
    if (hasPendingWithdrawal(telegramId)) {
      await processWithdrawalPin(ctx, text);
      return;
    }
    
    // Handle direct CA paste (attempt scan)
    if (text.length >= 32 && text.length <= 64 && !text.includes(' ')) {
      // Likely a token address, run scan
      const scanCtx = ctx as any;
      scanCtx.message.text = `/scan ${text}`;
      await handleScan(scanCtx);
      return;
    }
  });
  
  // Start bot
  await bot.launch();
  console.log('[Bot] Started successfully');
  
  return bot;
}

/**
 * Get bot instance
 */
export function getBot(): Telegraf | null {
  return bot;
}

/**
 * Stop bot
 */
export function stopBot(): void {
  if (bot) {
    bot.stop('SIGTERM');
    bot = null;
    console.log('[Bot] Stopped');
  }
}

/**
 * Send notification to user by user_id (from trades table)
 */
export async function notifyUser(userId: number, message: string): Promise<void> {
  if (!bot) return;
  
  // Get telegram_id from user_id
  const { getPool } = await import('../database/connection');
  const pool = getPool();
  const result = await pool.query<{ telegram_id: string }>(
    'SELECT telegram_id FROM users WHERE id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) return;
  
  const telegramId = result.rows[0].telegram_id;
  
  try {
    await bot.telegram.sendMessage(telegramId, message);
  } catch (error) {
    console.error(`[Bot] Failed to notify user ${userId}:`, (error as Error).message);
  }
}
