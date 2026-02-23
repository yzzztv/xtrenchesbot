import { getPool } from './connection';

export interface User {
  id: number;
  telegram_id: string;
  wallet_address: string;
  encrypted_private_key: string;
  pin_hash: string | null;
  auto_tp_enabled: boolean;
  auto_sl_enabled: boolean;
  autobuy_enabled: boolean;
  autobuy_score_threshold: number;
  created_at: Date;
}

/**
 * Find user by Telegram ID
 */
export async function findUserByTelegramId(telegramId: string): Promise<User | null> {
  const pool = getPool();
  const result = await pool.query<User>(
    'SELECT * FROM users WHERE telegram_id = $1',
    [telegramId]
  );
  return result.rows[0] || null;
}

/**
 * Create new user
 */
export async function createUser(
  telegramId: string,
  walletAddress: string,
  encryptedPrivateKey: string
): Promise<User> {
  const pool = getPool();
  const result = await pool.query<User>(
    `INSERT INTO users (telegram_id, wallet_address, encrypted_private_key)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [telegramId, walletAddress, encryptedPrivateKey]
  );
  return result.rows[0];
}

/**
 * Update user PIN hash
 */
export async function updateUserPin(userId: number, pinHash: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    'UPDATE users SET pin_hash = $1 WHERE id = $2',
    [pinHash, userId]
  );
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: number,
  settings: Partial<Pick<User, 'auto_tp_enabled' | 'auto_sl_enabled' | 'autobuy_enabled' | 'autobuy_score_threshold'>>
): Promise<void> {
  const pool = getPool();
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  if (settings.auto_tp_enabled !== undefined) {
    fields.push(`auto_tp_enabled = $${paramCount++}`);
    values.push(settings.auto_tp_enabled);
  }
  if (settings.auto_sl_enabled !== undefined) {
    fields.push(`auto_sl_enabled = $${paramCount++}`);
    values.push(settings.auto_sl_enabled);
  }
  if (settings.autobuy_enabled !== undefined) {
    fields.push(`autobuy_enabled = $${paramCount++}`);
    values.push(settings.autobuy_enabled);
  }
  if (settings.autobuy_score_threshold !== undefined) {
    fields.push(`autobuy_score_threshold = $${paramCount++}`);
    values.push(settings.autobuy_score_threshold);
  }
  
  if (fields.length === 0) return;
  
  values.push(userId);
  await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}`,
    values
  );
}

/**
 * Get total user count
 */
export async function getUserCount(): Promise<number> {
  const pool = getPool();
  const result = await pool.query('SELECT COUNT(*) as count FROM users');
  return parseInt(result.rows[0].count, 10);
}
