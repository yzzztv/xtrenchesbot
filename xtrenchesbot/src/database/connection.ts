import { Pool } from 'pg';
import { env } from '../config';

let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export async function initDatabase(): Promise<Pool> {
  if (pool) {
    return pool;
  }
  
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  
  // Test connection
  try {
    const client = await pool.connect();
    console.log('[DB] Connected to PostgreSQL');
    client.release();
    return pool;
  } catch (error) {
    console.error('[DB] Failed to connect to PostgreSQL:', (error as Error).message);
    process.exit(1);
  }
}

/**
 * Get database pool
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('[DB] Database not initialized. Call initDatabase() first.');
  }
  return pool;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[DB] Database connection closed');
  }
}
