import { Context, Markup } from 'telegraf';
import { findUserByTelegramId, getOpenTrades } from '../database';
import { getTokenData } from '../services';
import {
  mainMenuMessage,
  notRegisteredMessage,
  noPositionsMessage,
  positionsListMessage,
  settingsMessage,
  errorMessage,
} from './messageTemplates';

// Callback data constants
export const CALLBACK = {
  CHECK_PNL: 'menu_check_pnl',
  MY_WALLET: 'menu_my_wallet',
  MY_POSITIONS: 'menu_my_positions',
  SETTINGS: 'menu_settings',
  BACK_MAIN: 'menu_back_main',
} as const;

// Track users waiting for PNL CA input
const awaitingPnlInput = new Set<string>();

/**
 * Check if user is awaiting PNL input
 */
export function isAwaitingPnlInput(telegramId: string): boolean {
  return awaitingPnlInput.has(telegramId);
}

/**
 * Clear PNL input state
 */
export function clearPnlInputState(telegramId: string): void {
  awaitingPnlInput.delete(telegramId);
}

/**
 * Get main menu keyboard
 */
export function getMainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Check PNL', CALLBACK.CHECK_PNL)],
    [Markup.button.callback('My Wallet', CALLBACK.MY_WALLET)],
    [
      Markup.button.callback('My Positions', CALLBACK.MY_POSITIONS),
      Markup.button.callback('Settings', CALLBACK.SETTINGS),
    ],
  ]);
}

/**
 * Get main menu message text
 */
export function getMainMenuText(): string {
  return mainMenuMessage();
}

/**
 * Send main menu
 */
export async function sendMainMenu(ctx: Context): Promise<void> {
  await ctx.reply(getMainMenuText(), getMainMenuKeyboard());
}

/**
 * Edit message to main menu (for back button)
 */
export async function editToMainMenu(ctx: Context): Promise<void> {
  try {
    await ctx.editMessageText(getMainMenuText(), getMainMenuKeyboard());
  } catch (error) {
    // If edit fails, send new message
    await sendMainMenu(ctx);
  }
}

/**
 * Handle Check PNL button
 */
export async function handleCheckPnlButton(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    await ctx.answerCbQuery();
    
    // Set state to await CA input
    awaitingPnlInput.add(telegramId);
    
    await ctx.editMessageText(
      'Send the contract address to calculate PNL.',
      Markup.inlineKeyboard([
        [Markup.button.callback('Back', CALLBACK.BACK_MAIN)],
      ])
    );
  } catch (error) {
    console.error('[Menu] Check PNL button error:', error);
    await ctx.answerCbQuery(errorMessage());
  }
}

/**
 * Handle My Positions button
 */
export async function handleMyPositionsButton(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    await ctx.answerCbQuery();
    
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.editMessageText(
        notRegisteredMessage(),
        Markup.inlineKeyboard([
          [Markup.button.callback('Back', CALLBACK.BACK_MAIN)],
        ])
      );
      return;
    }
    
    const trades = await getOpenTrades(user.id);
    
    if (trades.length === 0) {
      await ctx.editMessageText(
        noPositionsMessage(),
        Markup.inlineKeyboard([
          [Markup.button.callback('Back', CALLBACK.BACK_MAIN)],
        ])
      );
      return;
    }
    
    // Build positions list
    const positions: Array<{ symbol: string; address: string }> = [];
    
    for (const trade of trades) {
      let symbol = 'Unknown';
      try {
        const tokenData = await getTokenData(trade.token_address);
        symbol = tokenData?.baseToken?.symbol || 'Unknown';
      } catch {
        // Token data fetch failed
      }
      positions.push({ symbol, address: trade.token_address });
    }
    
    await ctx.editMessageText(
      positionsListMessage(positions),
      Markup.inlineKeyboard([
        [Markup.button.callback('Check PNL', CALLBACK.CHECK_PNL)],
        [Markup.button.callback('Back', CALLBACK.BACK_MAIN)],
      ])
    );
  } catch (error) {
    console.error('[Menu] My Positions button error:', error);
    await ctx.answerCbQuery(errorMessage());
  }
}

/**
 * Handle Settings button
 */
export async function handleSettingsButton(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    await ctx.answerCbQuery();
    
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.editMessageText(
        notRegisteredMessage(),
        Markup.inlineKeyboard([
          [Markup.button.callback('Back', CALLBACK.BACK_MAIN)],
        ])
      );
      return;
    }
    
    await ctx.editMessageText(
      settingsMessage(user.auto_tp_enabled, user.auto_sl_enabled, user.autobuy_enabled),
      Markup.inlineKeyboard([
        [Markup.button.callback('Back', CALLBACK.BACK_MAIN)],
      ])
    );
  } catch (error) {
    console.error('[Menu] Settings button error:', error);
    await ctx.answerCbQuery(errorMessage());
  }
}

/**
 * Handle Back to Main button
 */
export async function handleBackMainButton(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (telegramId) {
    // Clear any pending states
    awaitingPnlInput.delete(telegramId);
  }
  
  try {
    await ctx.answerCbQuery();
    await editToMainMenu(ctx);
  } catch (error) {
    console.error('[Menu] Back button error:', error);
    await ctx.answerCbQuery(errorMessage());
  }
}
