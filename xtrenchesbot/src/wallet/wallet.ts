import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { env, CONFIG } from '../config';
import { encryptPrivateKey, decryptPrivateKey } from '../security';

let connection: Connection | null = null;

/**
 * Get Solana connection
 */
export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(env.HELIUS_RPC, 'confirmed');
  }
  return connection;
}

/**
 * Generate new Solana wallet
 */
export function generateWallet(): { publicKey: string; encryptedPrivateKey: string } {
  const keypair = Keypair.generate();
  const privateKeyBase58 = bs58.encode(keypair.secretKey);
  const encryptedPrivateKey = encryptPrivateKey(privateKeyBase58);
  
  return {
    publicKey: keypair.publicKey.toBase58(),
    encryptedPrivateKey,
  };
}

/**
 * Get keypair from encrypted private key
 */
export function getKeypair(encryptedPrivateKey: string): Keypair {
  const privateKeyBase58 = decryptPrivateKey(encryptedPrivateKey);
  const secretKey = bs58.decode(privateKeyBase58);
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Get SOL balance for address
 */
export async function getBalance(address: string): Promise<number> {
  const conn = getConnection();
  const publicKey = new PublicKey(address);
  
  for (let i = 0; i <= CONFIG.MAX_RPC_RETRIES; i++) {
    try {
      const balance = await conn.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      if (i === CONFIG.MAX_RPC_RETRIES) {
        throw new Error(`Failed to get balance after ${CONFIG.MAX_RPC_RETRIES} retries`);
      }
      await new Promise(resolve => setTimeout(resolve, CONFIG.RPC_RETRY_DELAY_MS));
    }
  }
  
  return 0;
}

/**
 * Transfer SOL from wallet
 */
export async function transferSol(
  encryptedPrivateKey: string,
  toAddress: string,
  amountSol: number
): Promise<string> {
  const conn = getConnection();
  const keypair = getKeypair(encryptedPrivateKey);
  const toPubkey = new PublicKey(toAddress);
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey,
      lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
    })
  );
  
  for (let i = 0; i <= CONFIG.MAX_RPC_RETRIES; i++) {
    try {
      const signature = await sendAndConfirmTransaction(conn, transaction, [keypair], {
        commitment: 'confirmed',
      });
      return signature;
    } catch (error) {
      if (i === CONFIG.MAX_RPC_RETRIES) {
        throw new Error(`Transfer failed after ${CONFIG.MAX_RPC_RETRIES} retries: ${(error as Error).message}`);
      }
      await new Promise(resolve => setTimeout(resolve, CONFIG.RPC_RETRY_DELAY_MS));
    }
  }
  
  throw new Error('Transfer failed');
}

/**
 * Validate Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get token balance for address
 */
export async function getTokenBalance(walletAddress: string, tokenAddress: string): Promise<number> {
  const conn = getConnection();
  const wallet = new PublicKey(walletAddress);
  const mint = new PublicKey(tokenAddress);
  
  try {
    const response = await conn.getParsedTokenAccountsByOwner(wallet, { mint });
    if (response.value.length === 0) return 0;
    
    const tokenAccount = response.value[0];
    const balance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
    return balance || 0;
  } catch {
    return 0;
  }
}
