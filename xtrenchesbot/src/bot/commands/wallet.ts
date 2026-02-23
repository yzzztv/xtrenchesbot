import { Context } from 'telegraf';
import { CONFIG } from '../config';
import { findUserByTelegramId, updateUserPin } from '../database';
import { isValidSolanaAddress, getBalance, transferSol } from '../wallet';
import { hashPin, verifyPin, isValidPin } from '../security';
import { formatSol } from '../utils';

/**
 * Handle /withdraw command
 * Format: /withdraw <amount> <destination_address>
 */
export async function handleWithdraw(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  const text = (ctx.message as any)?.text || '';
  const parts = text.split(/\s+/);
  
  if (parts.length < 3) {
    await ctx.reply(`Usage: /withdraw <SOL_amount> <destination_address>

Example: /withdraw 0.5 YourExternalWallet...

Note: Requires PIN. Set one with /setpin if you haven't.`);
    return;
  }
  
  const amountSol = parseFloat(parts[1]);
  const destination = parts[2];
  
  // Validate amount
  if (isNaN(amountSol) || amountSol <= 0) {
    await ctx.reply('Invalid withdrawal amount.');
    return;
  }
  
  // Validate destination
  if (!isValidSolanaAddress(destination)) {
    await ctx.reply('Invalid destination address.');
    return;
  }
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('Not registered. Run /start first.');
      return;
    }
    
    // Check if PIN is set
    if (!user.pin_hash) {
      await ctx.reply('No PIN set. Use /setpin <4digits> first.');
      return;
    }
    
    // Store pending withdrawal and ask for PIN
    // We'll use a simple approach: ask user to send PIN in next message
    // In production, you'd use a state machine or conversation handler
    
    await ctx.reply(`Withdrawal request:
Amount: ${formatSol(amountSol)} SOL
To: \`${destination}\`

Reply with your 4-digit PIN to confirm.
Or type 'cancel' to abort.`, { parse_mode: 'Markdown' });
    
    // Store pending withdrawal in a temporary way
    // For simplicity, we'll use a global map (in production, use Redis/DB)
    pendingWithdrawals.set(telegramId, {
      amount: amountSol,
      destination,
      expires: Date.now() + 60000, // 1 minute expiry
    });
    
  } catch (error) {
    console.error('[Bot] Withdraw error:', error);
    await ctx.reply('Withdrawal failed. Try again.');
  }
}

// Temporary storage for pending withdrawals
const pendingWithdrawals = new Map<string, {
  amount: number;
  destination: string;
  expires: number;
}>();

/**
 * Process PIN confirmation for withdrawal
 */
export async function processWithdrawalPin(ctx: Context, pin: string): Promise<boolean> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return false;
  
  const pending = pendingWithdrawals.get(telegramId);
  if (!pending) return false;
  
  // Check expiry
  if (Date.now() > pending.expires) {
    pendingWithdrawals.delete(telegramId);
    await ctx.reply('Withdrawal expired. Start again with /withdraw');
    return true;
  }
  
  // Handle cancel
  if (pin.toLowerCase() === 'cancel') {
    pendingWithdrawals.delete(telegramId);
    await ctx.reply('Withdrawal cancelled.');
    return true;
  }
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user || !user.pin_hash) return false;
    
    // Verify PIN
    const pinValid = await verifyPin(pin, user.pin_hash);
    if (!pinValid) {
      await ctx.reply('Invalid PIN. Try again or type "cancel".');
      return true;
    }
    
    // Check balance
    const balance = await getBalance(user.wallet_address);
    if (balance < pending.amount + 0.001) {
      await ctx.reply(`Insufficient balance.\nHave: ${formatSol(balance)} SOL\nNeed: ${formatSol(pending.amount + 0.001)} SOL (includes fee)`);
      pendingWithdrawals.delete(telegramId);
      return true;
    }
    
    // Execute withdrawal
    await ctx.reply('Processing withdrawal...');
    
    const signature = await transferSol(
      user.encrypted_private_key,
      pending.destination,
      pending.amount
    );
    
    pendingWithdrawals.delete(telegramId);
    
    await ctx.reply(`WITHDRAWAL COMPLETE

Amount: ${formatSol(pending.amount)} SOL
To: \`${pending.destination}\`
Tx: \`${signature.slice(0, 20)}...\`

Funds sent.`, { parse_mode: 'Markdown' });
    
    return true;
    
  } catch (error) {
    console.error('[Bot] Withdrawal processing error:', error);
    await ctx.reply(`Withdrawal failed: ${(error as Error).message}`);
    pendingWithdrawals.delete(telegramId);
    return true;
  }
}

/**
 * Check if user has pending withdrawal
 */
export function hasPendingWithdrawal(telegramId: string): boolean {
  const pending = pendingWithdrawals.get(telegramId);
  if (!pending) return false;
  if (Date.now() > pending.expires) {
    pendingWithdrawals.delete(telegramId);
    return false;
  }
  return true;
}

/**
 * Handle /setpin command
 * Format: /setpin <4 digits>
 */
export async function handleSetPin(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  const text = (ctx.message as any)?.text || '';
  const parts = text.split(/\s+/);
  
  if (parts.length < 2) {
    await ctx.reply('Usage: /setpin <4 digits>\n\nExample: /setpin 1234');
    return;
  }
  
  const pin = parts[1];
  
  if (!isValidPin(pin)) {
    await ctx.reply('PIN must be exactly 4 digits.');
    return;
  }
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('Not registered. Run /start first.');
      return;
    }
    
    // Hash and store PIN
    const pinHash = await hashPin(pin);
    await updateUserPin(user.id, pinHash);
    
    await ctx.reply('PIN set successfully.\n\nDon\'t forget it. Required for withdrawals.');
    
  } catch (error) {
    console.error('[Bot] SetPin error:', error);
    await ctx.reply('Failed to set PIN. Try again.');
  }
}
