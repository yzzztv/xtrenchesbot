import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { env } from '../config';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const SALT_ROUNDS = 10;

/**
 * Encrypt private key using AES-256-CBC
 */
export function encryptPrivateKey(privateKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.scryptSync(env.ENCRYPTION_SECRET, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt private key using AES-256-CBC
 */
export function decryptPrivateKey(encryptedData: string): string {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = crypto.scryptSync(env.ENCRYPTION_SECRET, 'salt', 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Hash PIN using bcrypt
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

/**
 * Verify PIN against bcrypt hash
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/**
 * Validate PIN format (4 digits)
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
