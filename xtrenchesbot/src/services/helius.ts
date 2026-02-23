import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { env } from '../config';
import { getConnection } from '../wallet';

interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
}

interface TokenHolder {
  address: string;
  amount: number;
  percentage: number;
}

/**
 * Get token metadata from Helius
 */
export async function getTokenMetadata(tokenAddress: string): Promise<TokenMetadata | null> {
  try {
    const response = await axios.post(env.HELIUS_RPC, {
      jsonrpc: '2.0',
      id: 'helius-metadata',
      method: 'getAsset',
      params: {
        id: tokenAddress,
      },
    });
    
    const asset = response.data.result;
    if (!asset) return null;
    
    return {
      mint: tokenAddress,
      name: asset.content?.metadata?.name || 'Unknown',
      symbol: asset.content?.metadata?.symbol || '???',
      decimals: asset.token_info?.decimals || 9,
      supply: asset.token_info?.supply || 0,
      mintAuthority: asset.mint_extensions?.mint_authority || null,
      freezeAuthority: asset.mint_extensions?.freeze_authority || null,
    };
  } catch (error) {
    console.error('[Helius] Metadata error:', (error as Error).message);
    return null;
  }
}

/**
 * Get top token holders
 */
export async function getTopHolders(tokenAddress: string, limit: number = 10): Promise<TokenHolder[]> {
  const conn = getConnection();
  const mint = new PublicKey(tokenAddress);
  
  try {
    const response = await conn.getTokenLargestAccounts(mint);
    const totalSupply = response.value.reduce((sum, acc) => sum + Number(acc.amount), 0);
    
    return response.value.slice(0, limit).map(account => ({
      address: account.address.toBase58(),
      amount: Number(account.amount),
      percentage: totalSupply > 0 ? (Number(account.amount) / totalSupply) * 100 : 0,
    }));
  } catch (error) {
    console.error('[Helius] Top holders error:', (error as Error).message);
    return [];
  }
}

/**
 * Get first transaction timestamp for token (age)
 */
export async function getTokenAge(tokenAddress: string): Promise<Date | null> {
  try {
    const response = await axios.post(env.HELIUS_RPC, {
      jsonrpc: '2.0',
      id: 'helius-signatures',
      method: 'getSignaturesForAddress',
      params: [
        tokenAddress,
        { limit: 1, before: null },
      ],
    });
    
    const signatures = response.data.result;
    if (!signatures || signatures.length === 0) return null;
    
    // Get the last (oldest) signature
    const lastSig = signatures[signatures.length - 1];
    if (lastSig?.blockTime) {
      return new Date(lastSig.blockTime * 1000);
    }
    return null;
  } catch (error) {
    console.error('[Helius] Token age error:', (error as Error).message);
    return null;
  }
}

export type { TokenMetadata, TokenHolder };
