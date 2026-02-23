import axios from 'axios';
import { env } from '../config';

interface DexscreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
}

interface DexscreenerResponse {
  schemaVersion: string;
  pairs: DexscreenerPair[] | null;
}

/**
 * Get token data from Dexscreener
 */
export async function getTokenData(tokenAddress: string): Promise<DexscreenerPair | null> {
  try {
    const response = await axios.get<DexscreenerResponse>(
      `${env.DEXSCREENER_API}/dex/tokens/${tokenAddress}`
    );
    
    if (!response.data.pairs || response.data.pairs.length === 0) {
      return null;
    }
    
    // Return Solana pair with highest liquidity
    const solanaPairs = response.data.pairs.filter(p => p.chainId === 'solana');
    if (solanaPairs.length === 0) {
      return null;
    }
    
    return solanaPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  } catch (error) {
    console.error('[Dexscreener] Error:', (error as Error).message);
    return null;
  }
}

/**
 * Get multiple token data
 */
export async function getMultipleTokenData(addresses: string[]): Promise<Map<string, DexscreenerPair>> {
  const result = new Map<string, DexscreenerPair>();
  
  // Dexscreener allows up to 30 addresses per request
  const chunks = [];
  for (let i = 0; i < addresses.length; i += 30) {
    chunks.push(addresses.slice(i, i + 30));
  }
  
  for (const chunk of chunks) {
    try {
      const response = await axios.get<DexscreenerResponse>(
        `${env.DEXSCREENER_API}/dex/tokens/${chunk.join(',')}`
      );
      
      if (response.data.pairs) {
        for (const pair of response.data.pairs) {
          if (pair.chainId === 'solana') {
            const existing = result.get(pair.baseToken.address);
            if (!existing || (pair.liquidity?.usd || 0) > (existing.liquidity?.usd || 0)) {
              result.set(pair.baseToken.address, pair);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Dexscreener] Batch error:', (error as Error).message);
    }
  }
  
  return result;
}

export type { DexscreenerPair };
