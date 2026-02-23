import { CONFIG } from '../config';
import { getAllOpenTrades, closeTrade, findUserByTelegramId, Trade } from '../database';
import { getTokenPrice, getMultipleTokenData } from '../services';
import { executeSell } from './executor';

type NotifyCallback = (userId: number, message: string) => Promise<void>;

let pollingInterval: NodeJS.Timeout | null = null;
let notifyCallback: NotifyCallback | null = null;

/**
 * Start TP/SL monitoring
 */
export function startTpSlMonitor(notify: NotifyCallback): void {
  notifyCallback = notify;
  
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  pollingInterval = setInterval(async () => {
    try {
      await checkOpenTrades();
    } catch (error) {
      console.error('[TP/SL] Poll error:', (error as Error).message);
    }
  }, CONFIG.TP_SL_POLL_INTERVAL);
  
  console.log(`[TP/SL] Monitor started (${CONFIG.TP_SL_POLL_INTERVAL / 1000}s interval)`);
}

/**
 * Stop TP/SL monitoring
 */
export function stopTpSlMonitor(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  console.log('[TP/SL] Monitor stopped');
}

/**
 * Check all open trades for TP/SL triggers
 */
async function checkOpenTrades(): Promise<void> {
  const trades = await getAllOpenTrades();
  
  if (trades.length === 0) return;
  
  // Get current prices for all tokens
  const tokenAddresses = [...new Set(trades.map(t => t.token_address))];
  const tokenData = await getMultipleTokenData(tokenAddresses);
  
  for (const trade of trades) {
    try {
      const dexData = tokenData.get(trade.token_address);
      if (!dexData) continue;
      
      const currentPrice = parseFloat(dexData.priceNative);
      const entryPrice = parseFloat(trade.entry_price);
      
      if (entryPrice <= 0) continue;
      
      const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      // Check TP
      if (pnlPercent >= CONFIG.DEFAULT_TP_PERCENT) {
        await triggerAutoClose(trade, 'TP', pnlPercent, currentPrice);
      }
      // Check SL
      else if (pnlPercent <= CONFIG.DEFAULT_SL_PERCENT) {
        await triggerAutoClose(trade, 'SL', pnlPercent, currentPrice);
      }
    } catch (error) {
      console.error(`[TP/SL] Error checking trade ${trade.id}:`, (error as Error).message);
    }
  }
}

/**
 * Trigger automatic close
 */
async function triggerAutoClose(
  trade: Trade,
  type: 'TP' | 'SL',
  pnlPercent: number,
  currentPrice: number
): Promise<void> {
  const pnlSol = (parseFloat(trade.amount_sol) * pnlPercent) / 100;
  
  // Close trade in DB
  await closeTrade(trade.id, currentPrice, pnlSol, pnlPercent);
  
  // Notify user
  if (notifyCallback) {
    const emoji = type === 'TP' ? '' : '';
    const message = type === 'TP' 
      ? `${type} HIT\n\nTrade auto-closed.\nPNL: +${pnlPercent.toFixed(2)}% (+${pnlSol.toFixed(4)} SOL)\n\nYou took profit. Good.`
      : `${type} HIT\n\nTrade auto-closed.\nPNL: ${pnlPercent.toFixed(2)}% (${pnlSol.toFixed(4)} SOL)\n\nCut the loss. Move on.`;
    
    try {
      await notifyCallback(trade.user_id, message);
    } catch (error) {
      console.error('[TP/SL] Notify error:', (error as Error).message);
    }
  }
  
  console.log(`[TP/SL] ${type} triggered for trade ${trade.id}: ${pnlPercent.toFixed(2)}%`);
}
