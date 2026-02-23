import { Context } from 'telegraf';
import { findUserByTelegramId, getOpenTrades, getTradeByToken, hasActivePosition, createPosition } from '../../database';
import { isValidSolanaAddress } from '../../wallet';
import { getTokenData } from '../../services';
import { calculateEntryScore, formatScoreMessage } from '../../scoring';
import { generatePnlCard } from '../../utils';
import { formatSol } from '../../utils';

/**
 * Handle CA paste - record position entry (NO image generation)
 */
export async function handleRecordPosition(ctx: Context, tokenAddress: string): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('Not registered. Run /start first.');
      return;
    }
    
    // Check if position already exists
    const existingPosition = await hasActivePosition(user.id, tokenAddress);
    if (existingPosition) {
      await ctx.reply(`Position already active for this token.\n\nUse /pnl ${tokenAddress.slice(0, 8)}... to check performance.`);
      return;
    }
    
    // Fetch current token data for entry price
    const tokenData = await getTokenData(tokenAddress);
    
    if (!tokenData) {
      await ctx.reply('Unable to fetch token data. Token may be too new or have no liquidity.');
      return;
    }
    
    const entryPrice = parseFloat(tokenData.priceNative || '0');
    
    if (entryPrice <= 0) {
      await ctx.reply('Unable to fetch current price. Try again later.');
      return;
    }
    
    // Record position in database
    await createPosition(user.id, tokenAddress, entryPrice);
    
    // Format time
    const entryTime = new Date();
    const formattedTime = entryTime.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    const symbol = tokenData.baseToken?.symbol || 'Unknown';
    const priceDisplay = entryPrice < 0.00001 
      ? entryPrice.toExponential(4) 
      : entryPrice < 0.01 
        ? entryPrice.toFixed(8) 
        : entryPrice.toFixed(6);
    
    // Text confirmation only - NO image
    await ctx.reply(`Position recorded

Token: ${symbol}
Entry Price: ${priceDisplay}
Time: ${formattedTime}

Use /pnl ${tokenAddress} to check performance.`);
    
  } catch (error) {
    console.error('[Bot] Record position error:', error);
    await ctx.reply('Failed to record position. Try again.');
  }
}

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
