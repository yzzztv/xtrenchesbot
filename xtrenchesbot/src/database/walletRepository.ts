import { getPool } from './connection';

export interface Wallet {
  id: string;
  user_id: number;
  encrypted_private_key: string;
  public_key: string;
  is_active: boolean;
  created_at: Date;
}

const MAX_WALLETS_PER_USER = 3;

/**
 * Get all wallets for a user
 */
export async function getUserWallets(userId: number): Promise<Wallet[]> {
  const pool = getPool();
  const result = await pool.query<Wallet>(
    'SELECT * FROM wallets WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  return result.rows;
}

/**
 * Get active wallet for a user
 */
export async function getActiveWallet(userId: number): Promise<Wallet | null> {
  const pool = getPool();
  const result = await pool.query<Wallet>(
    'SELECT * FROM wallets WHERE user_id = $1 AND is_active = true LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Get wallet by ID (with user ownership check)
 */
export async function getWalletById(walletId: string, userId: number): Promise<Wallet | null> {
  const pool = getPool();
  const result = await pool.query<Wallet>(
    'SELECT * FROM wallets WHERE id = $1 AND user_id = $2',
    [walletId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Get wallet count for user
 */
export async function getWalletCount(userId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM wallets WHERE user_id = $1',
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if user can add more wallets
 */
export async function canAddWallet(userId: number): Promise<boolean> {
  const count = await getWalletCount(userId);
  return count < MAX_WALLETS_PER_USER;
}

/**
 * Create a new wallet
 */
export async function createWallet(
  userId: number,
  publicKey: string,
  encryptedPrivateKey: string,
  setActive: boolean = false
): Promise<Wallet> {
  const pool = getPool();
  
  // If setting as active, deactivate others first
  if (setActive) {
    await pool.query(
      'UPDATE wallets SET is_active = false WHERE user_id = $1',
      [userId]
    );
  }
  
  const result = await pool.query<Wallet>(
    `INSERT INTO wallets (user_id, public_key, encrypted_private_key, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, publicKey, encryptedPrivateKey, setActive]
  );
  return result.rows[0];
}

/**
 * Set wallet as active
 */
export async function setActiveWallet(walletId: string, userId: number): Promise<boolean> {
  const pool = getPool();
  
  // First verify ownership
  const wallet = await getWalletById(walletId, userId);
  if (!wallet) return false;
  
  // Deactivate all user wallets
  await pool.query(
    'UPDATE wallets SET is_active = false WHERE user_id = $1',
    [userId]
  );
  
  // Activate selected wallet
  await pool.query(
    'UPDATE wallets SET is_active = true WHERE id = $1 AND user_id = $2',
    [walletId, userId]
  );
  
  return true;
}

/**
 * Delete a wallet
 */
export async function deleteWallet(walletId: string, userId: number): Promise<boolean> {
  const pool = getPool();
  
  // Verify ownership
  const wallet = await getWalletById(walletId, userId);
  if (!wallet) return false;
  
  const wasActive = wallet.is_active;
  
  // Delete wallet
  await pool.query(
    'DELETE FROM wallets WHERE id = $1 AND user_id = $2',
    [walletId, userId]
  );
  
  // If deleted wallet was active, assign another as active
  if (wasActive) {
    const remaining = await getUserWallets(userId);
    if (remaining.length > 0) {
      await setActiveWallet(remaining[0].id, userId);
    }
  }
  
  return true;
}

/**
 * Migrate existing user wallet to wallets table
 * Call this when user first accesses wallet manager
 */
export async function migrateUserWallet(
  userId: number,
  publicKey: string,
  encryptedPrivateKey: string
): Promise<Wallet | null> {
  const pool = getPool();
  
  // Check if already migrated
  const existing = await pool.query(
    'SELECT id FROM wallets WHERE user_id = $1 AND public_key = $2',
    [userId, publicKey]
  );
  
  if (existing.rows.length > 0) {
    return getWalletById(existing.rows[0].id, userId);
  }
  
  // Migrate
  return createWallet(userId, publicKey, encryptedPrivateKey, true);
}

export { MAX_WALLETS_PER_USER };
