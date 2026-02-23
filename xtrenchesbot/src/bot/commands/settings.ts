import { Context } from 'telegraf';
import { CONFIG } from '../../config';
import { findUserByTelegramId, updateUserSettings } from '../../database';

/**
 * Handle /settings command
 */
export async function handleSettings(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('Not registered. Run /start first.');
      return;
    }
    
    const message = `SETTINGS

Auto Take Profit: ${user.auto_tp_enabled ? 'ON' : 'OFF'}
  Trigger: +${CONFIG.DEFAULT_TP_PERCENT}%

Auto Stop Loss: ${user.auto_sl_enabled ? 'ON' : 'OFF'}
  Trigger: ${CONFIG.DEFAULT_SL_PERCENT}%

Auto Buy: ${user.autobuy_enabled ? 'ON' : 'OFF'}
  Score Threshold: ${user.autobuy_score_threshold}

PIN Set: ${user.pin_hash ? 'YES' : 'NO'}

Commands:
/tp on|off - Toggle auto TP
/sl on|off - Toggle auto SL
/setpin <4digits> - Set withdrawal PIN`;

    await ctx.reply(message);
    
  } catch (error) {
    console.error('[Bot] Settings error:', error);
    await ctx.reply('Failed to fetch settings.');
  }
}

/**
 * Handle /tp command
 * Format: /tp on|off
 */
export async function handleTp(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  const text = (ctx.message as any)?.text || '';
  const parts = text.split(/\s+/);
  
  if (parts.length < 2 || !['on', 'off'].includes(parts[1].toLowerCase())) {
    await ctx.reply('Usage: /tp on|off');
    return;
  }
  
  const enabled = parts[1].toLowerCase() === 'on';
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('Not registered. Run /start first.');
      return;
    }
    
    await updateUserSettings(user.id, { auto_tp_enabled: enabled });
    
    await ctx.reply(`Auto Take Profit: ${enabled ? 'ON' : 'OFF'}
Trigger: +${CONFIG.DEFAULT_TP_PERCENT}%

${enabled ? 'Positions will auto-close at TP.' : 'Manual sell required.'}`);
    
  } catch (error) {
    console.error('[Bot] TP toggle error:', error);
    await ctx.reply('Failed to update setting.');
  }
}

/**
 * Handle /sl command
 * Format: /sl on|off
 */
export async function handleSl(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  const text = (ctx.message as any)?.text || '';
  const parts = text.split(/\s+/);
  
  if (parts.length < 2 || !['on', 'off'].includes(parts[1].toLowerCase())) {
    await ctx.reply('Usage: /sl on|off');
    return;
  }
  
  const enabled = parts[1].toLowerCase() === 'on';
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('Not registered. Run /start first.');
      return;
    }
    
    await updateUserSettings(user.id, { auto_sl_enabled: enabled });
    
    await ctx.reply(`Auto Stop Loss: ${enabled ? 'ON' : 'OFF'}
Trigger: ${CONFIG.DEFAULT_SL_PERCENT}%

${enabled ? 'Positions will auto-close at SL.' : 'Manual sell required. Don\'t fumble.'}`);
    
  } catch (error) {
    console.error('[Bot] SL toggle error:', error);
    await ctx.reply('Failed to update setting.');
  }
}
