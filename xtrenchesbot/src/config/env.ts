import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvConfig {
  BOT_TOKEN: string;
  HELIUS_RPC: string;
  DATABASE_URL: string;
  ENCRYPTION_SECRET: string;
  JUPITER_API: string;
  DEXSCREENER_API: string;
}

function validateEnv(): EnvConfig {
  const required = [
    'BOT_TOKEN',
    'HELIUS_RPC',
    'DATABASE_URL',
    'ENCRYPTION_SECRET',
  ];
  
  const missing: string[] = [];
  
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
    console.error('[FATAL] Check your .env file and restart.');
    process.exit(1);
  }
  
  return {
    BOT_TOKEN: process.env.BOT_TOKEN!,
    HELIUS_RPC: process.env.HELIUS_RPC!,
    DATABASE_URL: process.env.DATABASE_URL!,
    ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET!,
    JUPITER_API: process.env.JUPITER_API || 'https://quote-api.jup.ag',
    DEXSCREENER_API: process.env.DEXSCREENER_API || 'https://api.dexscreener.com/latest',
  };
}

export const env = validateEnv();
