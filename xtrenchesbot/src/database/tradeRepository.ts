import { getPool } from './connection';

export interface Trade {
  id: number;
  user_id: number;
  token_address: string;
  entry_price: string;
  amount_sol: string;
  token_amount: string;
  status: 'open' | 'closed';
  opened_at: Date;
  closed_at: Date | null;
  exit_price: string | null;
  pnl_sol: string | null;
  pnl_percent: string | null;
}

/**
 * Create a new trade
 */
export async function createTrade(
  userId: number,
  tokenAddress: string,
  entryPrice: number,
  amountSol: number,
  tokenAmount: number
): Promise<Trade> {
  const pool = getPool();
  const result = await pool.query<Trade>(
    `INSERT INTO trades (user_id, token_address, entry_price, amount_sol, token_amount, status)
     VALUES ($1, $2, $3, $4, $5, 'open')
     RETURNING *`,
    [userId, tokenAddress, entryPrice, amountSol, tokenAmount]
  );
  return result.rows[0];
}

/**
 * Get open trades for a user
 */
export async function getOpenTrades(userId: number): Promise<Trade[]> {
  const pool = getPool();
  const result = await pool.query<Trade>(
    'SELECT * FROM trades WHERE user_id = $1 AND status = $2 ORDER BY opened_at DESC',
    [userId, 'open']
  );
  return result.rows;
}

/**
 * Get all open trades (for TP/SL polling)
 */
export async function getAllOpenTrades(): Promise<Trade[]> {
  const pool = getPool();
  const result = await pool.query<Trade>(
    'SELECT * FROM trades WHERE status = $1',
    ['open']
  );
  return result.rows;
}

/**
 * Get trade by token address for user
 */
export async function getTradeByToken(userId: number, tokenAddress: string): Promise<Trade | null> {
  const pool = getPool();
  const result = await pool.query<Trade>(
    'SELECT * FROM trades WHERE user_id = $1 AND token_address = $2 AND status = $3',
    [userId, tokenAddress, 'open']
  );
  return result.rows[0] || null;
}

/**
 * Close a trade
 */
export async function closeTrade(
  tradeId: number,
  exitPrice: number,
  pnlSol: number,
  pnlPercent: number
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE trades 
     SET status = 'closed', closed_at = NOW(), exit_price = $1, pnl_sol = $2, pnl_percent = $3
     WHERE id = $4`,
    [exitPrice, pnlSol, pnlPercent, tradeId]
  );
}

/**
 * Get closed trades for user
 */
export async function getClosedTrades(userId: number): Promise<Trade[]> {
  const pool = getPool();
  const result = await pool.query<Trade>(
    'SELECT * FROM trades WHERE user_id = $1 AND status = $2 ORDER BY closed_at DESC LIMIT 10',
    [userId, 'closed']
  );
  return result.rows;
}

/**
 * Get trade by ID
 */
export async function getTradeById(tradeId: number): Promise<Trade | null> {
  const pool = getPool();
  const result = await pool.query<Trade>(
    'SELECT * FROM trades WHERE id = $1',
    [tradeId]
  );
  return result.rows[0] || null;
}
