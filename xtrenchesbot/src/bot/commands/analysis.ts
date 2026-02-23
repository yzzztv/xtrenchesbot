import { Context } from 'telegraf';
import { findUserByTelegramId, getOpenTrades, getTradeByToken } from '../../database';
import { isValidSolanaAddress } from '../../wallet';
import { getTokenData } from '../../services';
import { calculateEntryScore, formatScoreMessage } from '../../scoring';
import { generatePnlCard } from '../../utils';
import { formatSol } from '../../utils';

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
 * Format: /pnl <CA>
 */
export async function handlePnl(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  const text = (ctx.message as any)?.text || '';
  const parts = text.split(/\s+/);
  
  // Require CA parameter
  if (parts.length < 2) {
    await ctx.reply('Usage: /pnl <token_address>');
    return;
  }
  
  const tokenAddress = parts[1];
  
  if (!isValidSolanaAddress(tokenAddress)) {
    await ctx.reply('Invalid token address.');
    return;
  }
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('Not registered. Run /start first.');
      return;
    }
    
    // Check for active position for this specific CA
    const trade = await getTradeByToken(user.id, tokenAddress);
    
    if (!trade) {
      await ctx.reply('No active position found for this contract address.');
      return;
    }
    
    // Fetch current token data
    const tokenData = await getTokenData(tokenAddress);
    
    if (!tokenData) {
      await ctx.reply('Unable to fetch current price. Try again later.');
      return;
    }
    
    const currentPrice = parseFloat(tokenData.priceNative || '0');
    const entryPrice = parseFloat(trade.entry_price);
    const amountSol = parseFloat(trade.amount_sol);
    
    if (currentPrice <= 0) {
      await ctx.reply('Unable to fetch current price. Try again later.');
      return;
    }
    
    // Calculate PNL
    let pnlPercent = 0;
    let pnlSol = 0;
    
    if (entryPrice > 0) {
      pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      pnlSol = amountSol > 0 ? amountSol * (pnlPercent / 100) : 0;
    }
    
    // Determine status label
    let statusLabel: string;
    if (pnlPercent > 0.2) {
      statusLabel = 'PROFIT';
    } else if (pnlPercent < -0.2) {
      statusLabel = 'LOSS';
    } else {
      statusLabel = 'NEUTRAL';
    }
    
    await ctx.reply(`Generating PNL card... ${statusLabel}`);
    
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
