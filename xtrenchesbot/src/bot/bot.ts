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
  hasPendingWithdrawal,
  handleRecordPosition
} from './commands';
import {
  CALLBACK,
  sendMainMenu,
  handleCheckPnlButton,
  handleMyPositionsButton,
  handleSettingsButton,
  handleBackMainButton,
  isAwaitingPnlInput,
  clearPnlInputState,
} from './menu';
import {
  WALLET_CALLBACK,
  handleWalletManagerButton,
  handleExportKeyButton,
  handleAddWalletButton,
  handleAddWalletConfirm,
  handleSetActiveWallet,
  handleRemoveWalletButton,
  handleRemoveWalletSelect,
  handleRemoveWalletConfirm,
  handleRemoveCancel,
  isAwaitingExportPin,
  clearExportPinState,
  processExportPin,
} from './walletManager';
import { findUserByTelegramId } from '../database';
import { isValidSolanaAddress } from '../wallet';

let bot: Telegraf | null = null;

/**
 * Handle /start command with menu
 */
async function handleStartWithMenu(ctx: Context): Promise<void> {
  // First run original start logic
  await handleStart(ctx);
  // Then show main menu
  await sendMainMenu(ctx);
}

/**
 * Handle /menu command
 */
async function handleMenuCommand(ctx: Context): Promise<void> {
  await sendMainMenu(ctx);
}

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
  
  // Register commands (kept as fallback)
  bot.command('start', handleStartWithMenu);
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
  bot.command('menu', handleMenuCommand);
  
  // Register callback query handlers for inline buttons
  bot.action(CALLBACK.CHECK_PNL, handleCheckPnlButton);
  bot.action(CALLBACK.MY_WALLET, handleWalletManagerButton);
  bot.action(CALLBACK.MY_POSITIONS, handleMyPositionsButton);
  bot.action(CALLBACK.SETTINGS, handleSettingsButton);
  bot.action(CALLBACK.BACK_MAIN, handleBackMainButton);
  
  // Wallet manager callbacks
  bot.action(WALLET_CALLBACK.MANAGER, handleWalletManagerButton);
  bot.action(WALLET_CALLBACK.EXPORT_KEY, handleExportKeyButton);
  bot.action(WALLET_CALLBACK.ADD_WALLET, handleAddWalletButton);
  bot.action(WALLET_CALLBACK.ADD_CONFIRM, handleAddWalletConfirm);
  bot.action(WALLET_CALLBACK.REMOVE_WALLET, handleRemoveWalletButton);
  bot.action(WALLET_CALLBACK.REMOVE_CANCEL, handleRemoveCancel);
  
  // Dynamic wallet callbacks (with ID suffix)
  bot.action(/^wallet_set_active_(.+)$/, async (ctx) => {
    const walletId = ctx.match[1];
    await handleSetActiveWallet(ctx, walletId);
  });
  bot.action(/^wallet_remove_select_(.+)$/, async (ctx) => {
    const walletId = ctx.match[1];
    await handleRemoveWalletSelect(ctx, walletId);
  });
  bot.action(/^wallet_remove_confirm_(.+)$/, async (ctx) => {
    const walletId = ctx.match[1];
    await handleRemoveWalletConfirm(ctx, walletId);
  });
  
  // Handle text messages (for PIN confirmation during withdrawal and PNL input)
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
    
    // Check if awaiting PNL CA input from button flow
    if (isAwaitingPnlInput(telegramId)) {
      clearPnlInputState(telegramId);
      
      // Validate as Solana address
      if (text.length >= 32 && text.length <= 64 && !text.includes(' ') && isValidSolanaAddress(text)) {
        // Call PNL handler with constructed context
        const pnlCtx = ctx as any;
        pnlCtx.message.text = `/pnl ${text}`;
        await handlePnl(pnlCtx);
      } else {
        await ctx.reply('Invalid contract address. Try again or use /menu to go back.');
      }
      return;
    }
    
    // Handle direct CA paste - record position (NO image generation)
    if (text.length >= 32 && text.length <= 64 && !text.includes(' ')) {
      // Validate as Solana address
      if (isValidSolanaAddress(text)) {
        await handleRecordPosition(ctx, text);
      }
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
