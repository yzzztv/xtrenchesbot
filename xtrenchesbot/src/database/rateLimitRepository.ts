import { getPool } from './connection';
import { CONFIG } from '../config';

interface RateLimit {
  user_id: number;
  trade_count: number;
  window_start: Date;
}

/**
 * Check and update rate limit for user
 * Returns true if within limit, false if exceeded
 */
export async function checkRateLimit(userId: number): Promise<boolean> {
  const pool = getPool();
  const now = new Date();
  const windowStart = new Date(now.getTime() - CONFIG.RATE_LIMIT_WINDOW_MS);
  
  // Get current rate limit record
  const result = await pool.query<RateLimit>(
    'SELECT * FROM rate_limits WHERE user_id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    // Create new record
    await pool.query(
      'INSERT INTO rate_limits (user_id, trade_count, window_start) VALUES ($1, 1, $2)',
      [userId, now]
    );
    return true;
  }
  
  const record = result.rows[0];
  const recordWindowStart = new Date(record.window_start);
  
  // Check if window has expired
  if (recordWindowStart < windowStart) {
    // Reset window
    await pool.query(
      'UPDATE rate_limits SET trade_count = 1, window_start = $1 WHERE user_id = $2',
      [now, userId]
    );
    return true;
  }
  
  // Check if within limit
  if (record.trade_count >= CONFIG.MAX_TRADES_PER_MINUTE) {
    return false;
  }
  
  // Increment counter
  await pool.query(
    'UPDATE rate_limits SET trade_count = trade_count + 1 WHERE user_id = $1',
    [userId]
  );
  
  return true;
}

/**
 * Get remaining trades for user in current window
 */
export async function getRemainingTrades(userId: number): Promise<number> {
  const pool = getPool();
  const windowStart = new Date(Date.now() - CONFIG.RATE_LIMIT_WINDOW_MS);
  
  const result = await pool.query<RateLimit>(
    'SELECT * FROM rate_limits WHERE user_id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    return CONFIG.MAX_TRADES_PER_MINUTE;
  }
  
  const record = result.rows[0];
  const recordWindowStart = new Date(record.window_start);
  
  if (recordWindowStart < windowStart) {
    return CONFIG.MAX_TRADES_PER_MINUTE;
  }
  
  return Math.max(0, CONFIG.MAX_TRADES_PER_MINUTE - record.trade_count);
}
