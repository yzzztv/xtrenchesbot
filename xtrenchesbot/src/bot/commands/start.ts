import { Context } from 'telegraf';
import { CONFIG } from '../config';
import { findUserByTelegramId, createUser, getUserCount } from '../database';
import { generateWallet, getBalance } from '../wallet';

/**
 * Handle /start command
 */
export async function handleStart(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    await ctx.reply('Error: Unable to identify user.');
    return;
  }
  
  try {
    // Check if user exists
    let user = await findUserByTelegramId(telegramId);
    
    if (!user) {
      // Check user limit
      const userCount = await getUserCount();
      if (userCount >= CONFIG.MAX_USERS) {
        await ctx.reply('Closed beta is full.\n\nMax 20 soldiers.\nCome back next deployment.');
        return;
      }
      
      // Generate new wallet
      const { publicKey, encryptedPrivateKey } = generateWallet();
      
      // Create user
      user = await createUser(telegramId, publicKey, encryptedPrivateKey);
      
      console.log(`[Bot] New user registered: ${telegramId} -> ${publicKey}`);
    }
    
    // Get balance
    const balance = await getBalance(user.wallet_address);
    
    const message = `Welcome to the trenches.

Send SOL to this war wallet:
\`${user.wallet_address}\`

Balance: ${balance.toFixed(4)} SOL
Minimum to fight: ${CONFIG.MIN_TRADE_BALANCE} SOL
Minimum buy: ${CONFIG.MIN_BUY_AMOUNT} SOL

You're not here to spectate.

Commands:
/buy <CA> <SOL> - Enter position
/sell <CA> <percent> - Exit position
/positions - View open trades
/pnl - View PNL card
/scan <CA> - Analyze token
/withdraw <SOL> - Withdraw funds
/setpin <4 digits> - Set PIN
/settings - View settings
/help - All commands`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('[Bot] Start error:', error);
    await ctx.reply('Something broke. Try again.');
  }
}

/**
 * Handle /help command
 */
export async function handleHelp(ctx: Context): Promise<void> {
  const message = `XTRENCHESBOT Commands

Trading:
/buy <CA> <SOL> - Buy token
/sell <CA> <percent> - Sell token (default: 100%)

Portfolio:
/positions - Open positions
/pnl - Generate PNL card
/balance - Check wallet balance

Analysis:
/scan <CA> - Token entry score

Wallet:
/withdraw <SOL> - Withdraw to external
/setpin <4 digits> - Set/change PIN

Settings:
/settings - View current settings
/tp <on/off> - Auto take profit
/sl <on/off> - Auto stop loss

Beta Info:
- Max ${CONFIG.MAX_USERS} users
- ${CONFIG.FEE_PERCENT}% fee
- TP: +${CONFIG.DEFAULT_TP_PERCENT}%
- SL: ${CONFIG.DEFAULT_SL_PERCENT}%

WAGMI`;

  await ctx.reply(message);
}

/**
 * Handle /balance command
 */
export async function handleBalance(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('Not registered. Run /start first.');
      return;
    }
    
    const balance = await getBalance(user.wallet_address);
    
    await ctx.reply(`Wallet: \`${user.wallet_address}\`

Balance: ${balance.toFixed(6)} SOL

${balance < CONFIG.MIN_TRADE_BALANCE ? 'Deposit more to trade.' : 'Ready to fight.'}`, 
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('[Bot] Balance error:', error);
    await ctx.reply('Failed to fetch balance.');
  }
}
