import axios from 'axios';
import { env, CONFIG } from '../config';

interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: any[];
}

interface SwapTransaction {
  swapTransaction: string;
}

/**
 * Get Jupiter quote for swap
 */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = CONFIG.DEFAULT_SLIPPAGE * 100
): Promise<JupiterQuote | null> {
  try {
    const response = await axios.get(`${env.JUPITER_API}/v6/quote`, {
      params: {
        inputMint,
        outputMint,
        amount: Math.floor(amount).toString(),
        slippageBps,
      },
    });
    return response.data;
  } catch (error) {
    console.error('[Jupiter] Quote error:', (error as Error).message);
    return null;
  }
}

/**
 * Get swap transaction from Jupiter
 */
export async function getSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: string
): Promise<string | null> {
  try {
    const response = await axios.post<SwapTransaction>(`${env.JUPITER_API}/v6/swap`, {
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    });
    return response.data.swapTransaction;
  } catch (error) {
    console.error('[Jupiter] Swap transaction error:', (error as Error).message);
    return null;
  }
}

/**
 * Get token price in SOL from Jupiter
 */
export async function getTokenPrice(tokenMint: string): Promise<number | null> {
  try {
    const response = await axios.get(`${env.JUPITER_API}/price/v2`, {
      params: {
        ids: tokenMint,
        vsToken: CONFIG.SOL_MINT,
      },
    });
    
    const data = response.data.data?.[tokenMint];
    if (data?.price) {
      return parseFloat(data.price);
    }
    return null;
  } catch (error) {
    console.error('[Jupiter] Price error:', (error as Error).message);
    return null;
  }
}

/**
 * Get token price in USD from Jupiter
 */
export async function getTokenPriceUSD(tokenMint: string): Promise<number | null> {
  try {
    const response = await axios.get(`${env.JUPITER_API}/price/v2`, {
      params: {
        ids: tokenMint,
      },
    });
    
    const data = response.data.data?.[tokenMint];
    if (data?.price) {
      return parseFloat(data.price);
    }
    return null;
  } catch (error) {
    console.error('[Jupiter] USD Price error:', (error as Error).message);
    return null;
  }
}
