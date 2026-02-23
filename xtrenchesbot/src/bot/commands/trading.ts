import { Context } from 'telegraf';
import { CONFIG } from '../../config';
import { findUserByTelegramId, checkRateLimit, getTradeByToken, getOpenTrades } from '../../database';
import { isValidSolanaAddress, getBalance } from '../../wallet';
import { executeBuy, executeSell } from '../../trading';
import { getTokenData } from '../../services';
import { formatSol, formatPercent } from '../../utils';

/**
 * Handle /buy command
 * Format: /buy <CA> <SOL amount>
 */
export async function handleBuy(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  const text = (ctx.message as any)?.text || '';
  const parts = text.split(/\s+/);
  
  // Parse arguments
  if (parts.length < 3) {
    await ctx.reply(`Usage: /buy <token_address> <SOL_amount>

Example: /buy So11111... 0.1`);
    return;
  }
  
  const tokenAddress = parts[1];
  const amountSol = parseFloat(parts[2]);
  
  // Validate token address
  if (!isValidSolanaAddress(tokenAddress)) {
    await ctx.reply('Invalid token address.');
    return;
  }
  
  // Validate amount
  if (isNaN(amountSol) || amountSol <= 0) {
    await ctx.reply('Invalid SOL amount.');
    return;
  }
  
  if (amountSol < CONFIG.MIN_BUY_AMOUNT) {
    await ctx.reply(`Minimum buy: ${CONFIG.MIN_BUY_AMOUNT} SOL`);
    return;
  }
  
  try {
    // Get user
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('Not registered. Run /start first.');
      return;
    }
    
    // Check balance
    const balance = await getBalance(user.wallet_address);
    if (balance < CONFIG.MIN_TRADE_BALANCE) {
      await ctx.reply(`Minimum balance: ${CONFIG.MIN_TRADE_BALANCE} SOL\nCurrent: ${formatSol(balance)} SOL`);
      return;
    }
    
    if (balance < amountSol + 0.01) {
      await ctx.reply(`Insufficient balance.\nHave: ${formatSol(balance)} SOL\nNeed: ${formatSol(amountSol + 0.01)} SOL (includes fees)`);
      return;
    }
    
    // Check rate limit
    const withinLimit = await checkRateLimit(user.id);
    if (!withinLimit) {
      await ctx.reply('Slow down soldier.');
      return;
    }
    
    // Check if already have open position
    const existingTrade = await getTradeByToken(user.id, tokenAddress);
    if (existingTrade) {
      await ctx.reply('Already have open position on this token.\nSell first or use different token.');
      return;
    }
    
    // Send "processing" message
    const processingMsg = await ctx.reply('Executing buy...');
    
    // Execute buy
    const result = await executeBuy(
      user.id,
      user.encrypted_private_key,
      user.wallet_address,
      tokenAddress,
      amountSol
    );
    
    if (result.success) {
      // Get token info for display
      const tokenData = await getTokenData(tokenAddress);
      const tokenSymbol = tokenData?.baseToken?.symbol || 'Unknown';
      
      await ctx.reply(`BUY EXECUTED

Token: ${tokenSymbol}
Amount: ${formatSol(amountSol)} SOL
Tx: \`${result.signature?.slice(0, 20)}...\`

Position open. Watch it or set TP/SL.`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`Buy failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('[Bot] Buy error:', error);
    await ctx.reply('Buy failed. Try again.');
  }
}

/**
 * Handle /sell command
 * Format: /sell <CA> [percent]
 */
export async function handleSell(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  const text = (ctx.message as any)?.text || '';
  const parts = text.split(/\s+/);
  
  // Parse arguments
  if (parts.length < 2) {
    await ctx.reply(`Usage: /sell <token_address> [percent]

Examples:
/sell So11111... 100 (sell all)
/sell So11111... 50 (sell half)`);
    return;
  }
  
  const tokenAddress = parts[1];
  const percent = parts[2] ? parseFloat(parts[2]) : 100;
  
  // Validate token address
  if (!isValidSolanaAddress(tokenAddress)) {
    await ctx.reply('Invalid token address.');
    return;
  }
  
  // Validate percent
  if (isNaN(percent) || percent <= 0 || percent > 100) {
    await ctx.reply('Invalid percentage (1-100).');
    return;
  }
  
  try {
    // Get user
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('Not registered. Run /start first.');
      return;
    }
    
    // Check rate limit
    const withinLimit = await checkRateLimit(user.id);
    if (!withinLimit) {
      await ctx.reply('Slow down soldier.');
      return;
    }
    
    // Send "processing" message
    await ctx.reply('Executing sell...');
    
    // Execute sell
    const result = await executeSell(
      user.id,
      user.encrypted_private_key,
      user.wallet_address,
      tokenAddress,
      percent
    );
    
    if (result.success) {
      const pnlSign = (result.pnl || 0) >= 0 ? '+' : '';
      
      await ctx.reply(`SELL EXECUTED

Sold: ${percent}%
PNL: ${formatPercent(result.pnlPercent || 0)} (${pnlSign}${formatSol(result.pnl || 0)} SOL)
Tx: \`${result.signature?.slice(0, 20)}...\`

${(result.pnl || 0) >= 0 ? 'Profit secured.' : 'Loss cut. Move on.'}`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`Sell failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('[Bot] Sell error:', error);
    await ctx.reply('Sell failed. Try again.');
  }
}

/**
 * Handle /positions command
 */
export async function handlePositions(ctx: Context): Promise<void> {
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
      await ctx.reply('No open positions.\n\nUse /buy <CA> <SOL> to enter.');
      return;
    }
    
    const lines: string[] = ['OPEN POSITIONS', ''];
    
    for (const trade of trades) {
      const tokenData = await getTokenData(trade.token_address);
      const symbol = tokenData?.baseToken?.symbol || 'Unknown';
      const currentPrice = parseFloat(tokenData?.priceNative || '0');
      const entryPrice = parseFloat(trade.entry_price);
      
      let pnlPercent = 0;
      if (entryPrice > 0 && currentPrice > 0) {
        pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      }
      
      lines.push(`${symbol}`);
      lines.push(`Entry: ${formatSol(parseFloat(trade.amount_sol))} SOL`);
      lines.push(`PNL: ${formatPercent(pnlPercent)}`);
      lines.push(`CA: \`${trade.token_address.slice(0, 8)}...\``);
      lines.push('');
    }
    
    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('[Bot] Positions error:', error);
    await ctx.reply('Failed to fetch positions.');
  }
}
