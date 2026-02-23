import { 
  Transaction, 
  VersionedTransaction, 
  Connection,
  Keypair,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { CONFIG, env } from '../config';
import { getConnection, getKeypair, getBalance, getTokenBalance } from '../wallet';
import { getQuote, getSwapTransaction, getTokenPrice } from '../services';
import { createTrade, closeTrade, getTradeByToken, Trade } from '../database';

/**
 * Execute buy transaction
 */
export async function executeBuy(
  userId: number,
  encryptedPrivateKey: string,
  walletAddress: string,
  tokenAddress: string,
  amountSol: number,
  slippageBps: number = CONFIG.DEFAULT_SLIPPAGE * 100
): Promise<{ success: boolean; signature?: string; trade?: Trade; error?: string }> {
  
  // Validate minimum buy amount
  if (amountSol < CONFIG.MIN_BUY_AMOUNT) {
    return { success: false, error: `Minimum buy: ${CONFIG.MIN_BUY_AMOUNT} SOL` };
  }
  
  // Validate slippage
  if (slippageBps > CONFIG.MAX_SLIPPAGE * 100) {
    return { success: false, error: `Max slippage: ${CONFIG.MAX_SLIPPAGE}%` };
  }
  
  // Check balance
  const balance = await getBalance(walletAddress);
  if (balance < amountSol + 0.01) { // Reserve for fees
    return { success: false, error: `Insufficient balance. Have: ${balance.toFixed(4)} SOL` };
  }
  
  // Get quote
  const inputAmount = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const quote = await getQuote(CONFIG.SOL_MINT, tokenAddress, inputAmount, slippageBps);
  
  if (!quote) {
    return { success: false, error: 'Failed to get swap quote' };
  }
  
  // Get swap transaction
  const swapTxBase64 = await getSwapTransaction(quote, walletAddress);
  if (!swapTxBase64) {
    return { success: false, error: 'Failed to build swap transaction' };
  }
  
  // Execute transaction
  const conn = getConnection();
  const keypair = getKeypair(encryptedPrivateKey);
  
  for (let attempt = 0; attempt <= CONFIG.MAX_RPC_RETRIES; attempt++) {
    try {
      const swapTxBuf = Buffer.from(swapTxBase64, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTxBuf);
      
      transaction.sign([keypair]);
      
      const signature = await conn.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 2,
      });
      
      // Wait for confirmation
      const confirmation = await conn.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      // Get entry price and token amount
      const tokenPrice = await getTokenPrice(tokenAddress);
      const tokenAmount = parseFloat(quote.outAmount);
      
      // Save trade to database
      const trade = await createTrade(
        userId,
        tokenAddress,
        tokenPrice || 0,
        amountSol,
        tokenAmount
      );
      
      return { success: true, signature, trade };
      
    } catch (error) {
      if (attempt === CONFIG.MAX_RPC_RETRIES) {
        return { success: false, error: `Buy failed: ${(error as Error).message}` };
      }
      await new Promise(resolve => setTimeout(resolve, CONFIG.RPC_RETRY_DELAY_MS));
    }
  }
  
  return { success: false, error: 'Buy failed after retries' };
}

/**
 * Execute sell transaction
 */
export async function executeSell(
  userId: number,
  encryptedPrivateKey: string,
  walletAddress: string,
  tokenAddress: string,
  percentToSell: number = 100,
  slippageBps: number = CONFIG.DEFAULT_SLIPPAGE * 100
): Promise<{ success: boolean; signature?: string; pnl?: number; pnlPercent?: number; error?: string }> {
  
  // Validate percentage
  if (percentToSell <= 0 || percentToSell > 100) {
    return { success: false, error: 'Invalid sell percentage (1-100)' };
  }
  
  // Get token balance
  const tokenBalance = await getTokenBalance(walletAddress, tokenAddress);
  if (tokenBalance <= 0) {
    return { success: false, error: 'No tokens to sell' };
  }
  
  // Get open trade
  const trade = await getTradeByToken(userId, tokenAddress);
  if (!trade) {
    return { success: false, error: 'No open trade found for this token' };
  }
  
  // Calculate amount to sell
  const sellAmount = Math.floor((tokenBalance * percentToSell / 100) * 1e9); // Convert to smallest unit
  
  // Get quote
  const quote = await getQuote(tokenAddress, CONFIG.SOL_MINT, sellAmount, slippageBps);
  if (!quote) {
    return { success: false, error: 'Failed to get sell quote' };
  }
  
  // Get swap transaction
  const swapTxBase64 = await getSwapTransaction(quote, walletAddress);
  if (!swapTxBase64) {
    return { success: false, error: 'Failed to build sell transaction' };
  }
  
  // Execute transaction
  const conn = getConnection();
  const keypair = getKeypair(encryptedPrivateKey);
  
  for (let attempt = 0; attempt <= CONFIG.MAX_RPC_RETRIES; attempt++) {
    try {
      const swapTxBuf = Buffer.from(swapTxBase64, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTxBuf);
      
      transaction.sign([keypair]);
      
      const signature = await conn.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 2,
      });
      
      // Wait for confirmation
      const confirmation = await conn.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      // Calculate PNL
      const solReceived = parseFloat(quote.outAmount) / LAMPORTS_PER_SOL;
      const entryValue = parseFloat(trade.amount_sol);
      const pnl = solReceived - entryValue;
      const pnlPercent = ((solReceived - entryValue) / entryValue) * 100;
      
      // Close trade if selling 100%
      if (percentToSell === 100) {
        const exitPrice = await getTokenPrice(tokenAddress) || 0;
        await closeTrade(trade.id, exitPrice, pnl, pnlPercent);
      }
      
      return { success: true, signature, pnl, pnlPercent };
      
    } catch (error) {
      if (attempt === CONFIG.MAX_RPC_RETRIES) {
        return { success: false, error: `Sell failed: ${(error as Error).message}` };
      }
      await new Promise(resolve => setTimeout(resolve, CONFIG.RPC_RETRY_DELAY_MS));
    }
  }
  
  return { success: false, error: 'Sell failed after retries' };
}
