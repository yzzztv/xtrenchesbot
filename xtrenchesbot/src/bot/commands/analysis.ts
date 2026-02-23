import { Context } from 'telegraf';
import { findUserByTelegramId, getOpenTrades } from '../database';
import { isValidSolanaAddress } from '../wallet';
import { getTokenData } from '../services';
import { calculateEntryScore, formatScoreMessage } from '../scoring';
import { generatePnlCard } from '../utils';
import { formatSol } from '../utils';

/**
 * Handle /scan command
 * Format: /scan <CA>
 */
export async function handleScan(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  const text = (ctx.message as any)?.text || '';
  const parts = text.split(/\s+/);
  
  if (parts.length < 2) {
    await ctx.reply('Usage: /scan <token_address>');
    return;
  }
  
  const tokenAddress = parts[1];
  
  if (!isValidSolanaAddress(tokenAddress)) {
    await ctx.reply('Invalid token address.');
    return;
  }
  
  try {
    await ctx.reply('Scanning...');
    
    // Get token data
    const dexData = await getTokenData(tokenAddress);
    if (!dexData) {
      await ctx.reply('Token not found on DEX.\n\nMight be too new or no liquidity.');
      return;
    }
    
    // Calculate score
    const score = await calculateEntryScore(tokenAddress);
    
    // Format message
    const message = formatScoreMessage(
      dexData.baseToken?.symbol || 'Unknown',
      dexData.baseToken?.name || 'Unknown Token',
      score,
      dexData
    );
    
    await ctx.reply(message);
    
  } catch (error) {
    console.error('[Bot] Scan error:', error);
    await ctx.reply('Scan failed. Try again.');
  }
}

/**
 * Handle /pnl command
 */
export async function handlePnl(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('Not registered. Run /start first.');
      return;
    }
    
    const trades = await getOpenTrades(user.id);
    
    if (trades.length === 0) {
      await ctx.reply('No open positions for PNL card.\n\nEnter a trade first.');
      return;
    }
    
    // Use first open trade for PNL card
    const trade = trades[0];
    const tokenData = await getTokenData(trade.token_address);
    
    if (!tokenData) {
      await ctx.reply('Failed to fetch token data.');
      return;
    }
    
    const currentPrice = parseFloat(tokenData.priceNative || '0');
    const entryPrice = parseFloat(trade.entry_price);
    const amountSol = parseFloat(trade.amount_sol);
    
    let pnlPercent = 0;
    let pnlSol = 0;
    
    if (entryPrice > 0 && currentPrice > 0) {
      pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      pnlSol = amountSol * (pnlPercent / 100);
    }
    
    await ctx.reply('Generating PNL card...');
    
    // Generate PNL card
    const cardBuffer = await generatePnlCard({
      tokenName: tokenData.baseToken?.name || 'Unknown',
      tokenSymbol: tokenData.baseToken?.symbol || '???',
      entryPrice,
      currentPrice,
      pnlPercent,
      pnlSol,
    });
    
    // Send as photo
    await ctx.replyWithPhoto({ source: cardBuffer });
    
  } catch (error) {
    console.error('[Bot] PNL error:', error);
    await ctx.reply('Failed to generate PNL card.');
  }
}
