import { Context, Markup } from 'telegraf';
import { 
  findUserByTelegramId, 
  getUserWallets, 
  getActiveWallet, 
  getWalletById,
  canAddWallet,
  createWallet,
  setActiveWallet,
  deleteWallet,
  migrateUserWallet,
  MAX_WALLETS_PER_USER,
  Wallet
} from '../database';
import { generateWallet, getBalance } from '../wallet';
import { decryptPrivateKey, verifyPin } from '../security';
import {
  walletManagerMessage,
  walletCreatedMessage,
  walletSwitchedMessage,
  walletRemovedMessage,
  walletLimitMessage,
  walletExportPinPrompt,
  walletExportSuccess,
  walletExportAutoDeleted,
  walletExportDeleteFailed,
  walletNoPinSet,
  walletRemoveConfirm,
  walletCannotRemoveLast,
  notRegisteredMessage,
  errorMessage,
  pinIncorrect,
  maskAddress,
} from './messageTemplates';

// Callback data constants for wallet manager
export const WALLET_CALLBACK = {
  MANAGER: 'wallet_manager',
  EXPORT_KEY: 'wallet_export_key',
  EXPORT_CONFIRM: 'wallet_export_confirm',
  ADD_WALLET: 'wallet_add',
  ADD_CONFIRM: 'wallet_add_confirm',
  REMOVE_WALLET: 'wallet_remove',
  REMOVE_SELECT: 'wallet_remove_select_',
  REMOVE_CONFIRM: 'wallet_remove_confirm_',
  REMOVE_CANCEL: 'wallet_remove_cancel',
  SELECT_WALLET: 'wallet_select_',
  SET_ACTIVE: 'wallet_set_active_',
  BACK_WALLET: 'wallet_back',
} as const;

// State tracking
const awaitingExportPin = new Set<string>();
const pendingRemoval = new Map<string, string>(); // telegramId -> walletId

/**
 * Check if user is awaiting export PIN
 */
export function isAwaitingExportPin(telegramId: string): boolean {
  return awaitingExportPin.has(telegramId);
}

/**
 * Clear export PIN state
 */
export function clearExportPinState(telegramId: string): void {
  awaitingExportPin.delete(telegramId);
}

/**
 * Get wallet manager keyboard
 */
function getWalletManagerKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Export Private Key', WALLET_CALLBACK.EXPORT_KEY)],
    [Markup.button.callback('Add Wallet', WALLET_CALLBACK.ADD_WALLET)],
    [Markup.button.callback('Remove Wallet', WALLET_CALLBACK.REMOVE_WALLET)],
    [Markup.button.callback('Back', 'menu_back_main')],
  ]);
}

/**
 * Handle Wallet Manager button - main wallet view
 */
export async function handleWalletManagerButton(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    await ctx.answerCbQuery();
    
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.editMessageText(
        notRegisteredMessage(),
        Markup.inlineKeyboard([[Markup.button.callback('Back', 'menu_back_main')]])
      );
      return;
    }
    
    // Migrate existing wallet if needed
    await migrateUserWallet(user.id, user.wallet_address, user.encrypted_private_key);
    
    // Get wallets
    const wallets = await getUserWallets(user.id);
    const activeWallet = wallets.find(w => w.is_active);
    
    // Get balance for active wallet
    let balance = 0;
    if (activeWallet) {
      try {
        balance = await getBalance(activeWallet.public_key);
      } catch {
        // Balance fetch failed
      }
    }
    
    const activeAddress = activeWallet ? maskAddress(activeWallet.public_key) : 'None';

    await ctx.editMessageText(
      walletManagerMessage(activeAddress, balance, wallets.length, MAX_WALLETS_PER_USER),
      getWalletManagerKeyboard()
    );
    
  } catch (error) {
    console.error('[WalletManager] Error:', error);
    await ctx.answerCbQuery(errorMessage());
  }
}

/**
 * Handle Export Key button - request PIN
 */
export async function handleExportKeyButton(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    await ctx.answerCbQuery();
    
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.editMessageText(
        notRegisteredMessage(),
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
      return;
    }
    
    if (!user.pin_hash) {
      await ctx.editMessageText(
        walletNoPinSet(),
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
      return;
    }
    
    // Set state to await PIN
    awaitingExportPin.add(telegramId);
    
    await ctx.editMessageText(
      walletExportPinPrompt(),
      Markup.inlineKeyboard([[Markup.button.callback('Cancel', WALLET_CALLBACK.MANAGER)]])
    );
    
  } catch (error) {
    console.error('[WalletManager] Export key error:', error);
    await ctx.answerCbQuery(errorMessage());
  }
}

/**
 * Process PIN input for export
 */
export async function processExportPin(ctx: Context, pin: string): Promise<boolean> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return false;
  
  // Clear state
  awaitingExportPin.delete(telegramId);
  
  // Handle cancel
  if (pin.toLowerCase() === 'cancel') {
    await ctx.reply('Export cancelled.');
    return true;
  }
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user || !user.pin_hash) {
      await ctx.reply(errorMessage('User or PIN not found.'));
      return true;
    }
    
    // Verify PIN
    const pinValid = await verifyPin(pin, user.pin_hash);
    if (!pinValid) {
      await ctx.reply(pinIncorrect());
      return true;
    }
    
    // Get active wallet
    const activeWallet = await getActiveWallet(user.id);
    const encryptedKey = activeWallet?.encrypted_private_key || user.encrypted_private_key;
    
    // Decrypt private key
    let privateKey: string;
    try {
      privateKey = decryptPrivateKey(encryptedKey);
    } catch {
      await ctx.reply(errorMessage('Failed to decrypt key.'));
      return true;
    }
    
    // Send private key with warning
    const keyMessage = await ctx.reply(
      walletExportSuccess(privateKey),
      { parse_mode: 'Markdown' }
    );
    
    // Clear from memory
    privateKey = '';
    
    // Try to delete message after 30 seconds
    setTimeout(async () => {
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, keyMessage.message_id);
        await ctx.reply(walletExportAutoDeleted());
      } catch {
        await ctx.reply(walletExportDeleteFailed());
      }
    }, 30000);
    
    return true;
    
  } catch (error) {
    console.error('[WalletManager] Export PIN error:', error);
    await ctx.reply(errorMessage('Export failed.'));
    return true;
  }
}

/**
 * Handle Add Wallet button
 */
export async function handleAddWalletButton(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    await ctx.answerCbQuery();
    
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await ctx.editMessageText(
        notRegisteredMessage(),
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
      return;
    }
    
    // Check wallet limit
    const canAdd = await canAddWallet(user.id);
    if (!canAdd) {
      await ctx.editMessageText(
        walletLimitMessage(MAX_WALLETS_PER_USER),
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
      return;
    }
    
    await ctx.editMessageText(
      'Create a new wallet?\n\nThis will generate a new Solana keypair.',
      Markup.inlineKeyboard([
        [Markup.button.callback('Confirm', WALLET_CALLBACK.ADD_CONFIRM)],
        [Markup.button.callback('Cancel', WALLET_CALLBACK.MANAGER)],
      ])
    );
    
  } catch (error) {
    console.error('[WalletManager] Add wallet error:', error);
    await ctx.answerCbQuery(errorMessage());
  }
}

/**
 * Handle Add Wallet confirmation
 */
export async function handleAddWalletConfirm(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    await ctx.answerCbQuery();
    
    const user = await findUserByTelegramId(telegramId);
    if (!user) return;
    
    // Double check limit
    const canAdd = await canAddWallet(user.id);
    if (!canAdd) {
      await ctx.editMessageText(
        walletLimitMessage(MAX_WALLETS_PER_USER),
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
      return;
    }
    
    // Generate new wallet
    const { publicKey, encryptedPrivateKey } = generateWallet();
    
    // Save to database
    const newWallet = await createWallet(user.id, publicKey, encryptedPrivateKey, false);
    
    await ctx.editMessageText(
      walletCreatedMessage(publicKey, maskAddress(publicKey)),
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Set as Active', `${WALLET_CALLBACK.SET_ACTIVE}${newWallet.id}`)],
          [Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)],
        ]),
      }
    );
    
  } catch (error) {
    console.error('[WalletManager] Add confirm error:', error);
    await ctx.answerCbQuery(errorMessage());
  }
}

/**
 * Handle Set Active wallet
 */
export async function handleSetActiveWallet(ctx: Context, walletId: string): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    await ctx.answerCbQuery();
    
    const user = await findUserByTelegramId(telegramId);
    if (!user) return;
    
    const success = await setActiveWallet(walletId, user.id);
    
    if (success) {
      const wallet = await getWalletById(walletId, user.id);
      await ctx.editMessageText(
        walletSwitchedMessage(maskAddress(wallet?.public_key || '')),
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
    } else {
      await ctx.editMessageText(
        errorMessage('Failed to switch wallet.'),
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
    }
    
  } catch (error) {
    console.error('[WalletManager] Set active error:', error);
    await ctx.answerCbQuery(errorMessage());
  }
}

/**
 * Handle Remove Wallet button - show list
 */
export async function handleRemoveWalletButton(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    await ctx.answerCbQuery();
    
    const user = await findUserByTelegramId(telegramId);
    if (!user) return;
    
    const wallets = await getUserWallets(user.id);
    
    if (wallets.length === 0) {
      await ctx.editMessageText(
        errorMessage('No wallets to remove.'),
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
      return;
    }
    
    if (wallets.length === 1) {
      await ctx.editMessageText(
        walletCannotRemoveLast(),
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
      return;
    }
    
    // Build wallet list buttons
    const walletButtons = wallets.map((w, i) => {
      const label = `${maskAddress(w.public_key)}${w.is_active ? ' (Active)' : ''}`;
      return [Markup.button.callback(label, `${WALLET_CALLBACK.REMOVE_SELECT}${w.id}`)];
    });
    
    walletButtons.push([Markup.button.callback('Cancel', WALLET_CALLBACK.MANAGER)]);
    
    await ctx.editMessageText(
      'Select wallet to remove:',
      Markup.inlineKeyboard(walletButtons)
    );
    
  } catch (error) {
    console.error('[WalletManager] Remove wallet error:', error);
    await ctx.answerCbQuery(errorMessage());
  }
}

/**
 * Handle Remove Wallet selection - show confirmation
 */
export async function handleRemoveWalletSelect(ctx: Context, walletId: string): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    await ctx.answerCbQuery();
    
    const user = await findUserByTelegramId(telegramId);
    if (!user) return;
    
    const wallet = await getWalletById(walletId, user.id);
    if (!wallet) {
      await ctx.editMessageText(
        errorMessage('Wallet not found.'),
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
      return;
    }
    
    // Store pending removal
    pendingRemoval.set(telegramId, walletId);
    
    await ctx.editMessageText(
      walletRemoveConfirm(maskAddress(wallet.public_key), wallet.is_active),
      Markup.inlineKeyboard([
        [Markup.button.callback('Confirm Delete', `${WALLET_CALLBACK.REMOVE_CONFIRM}${walletId}`)],
        [Markup.button.callback('Cancel', WALLET_CALLBACK.REMOVE_CANCEL)],
      ])
    );
    
  } catch (error) {
    console.error('[WalletManager] Remove select error:', error);
    await ctx.answerCbQuery(errorMessage());
  }
}

/**
 * Handle Remove Wallet confirmation
 */
export async function handleRemoveWalletConfirm(ctx: Context, walletId: string): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;
  
  try {
    await ctx.answerCbQuery();
    
    const user = await findUserByTelegramId(telegramId);
    if (!user) return;
    
    // Verify this is the pending removal
    const pendingId = pendingRemoval.get(telegramId);
    if (pendingId !== walletId) {
      await ctx.editMessageText(
        errorMessage('Invalid request.'),
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
      return;
    }
    
    pendingRemoval.delete(telegramId);
    
    const success = await deleteWallet(walletId, user.id);
    
    if (success) {
      await ctx.editMessageText(
        'Wallet removed successfully.',
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
    } else {
      await ctx.editMessageText(
        'Failed to remove wallet.',
        Markup.inlineKeyboard([[Markup.button.callback('Back', WALLET_CALLBACK.MANAGER)]])
      );
    }
    
  } catch (error) {
    console.error('[WalletManager] Remove confirm error:', error);
    await ctx.answerCbQuery('Failed to remove wallet.');
  }
}

/**
 * Handle Remove cancel
 */
export async function handleRemoveCancel(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (telegramId) {
    pendingRemoval.delete(telegramId);
  }
  
  try {
    await ctx.answerCbQuery();
    await handleWalletManagerButton(ctx);
  } catch (error) {
    console.error('[WalletManager] Remove cancel error:', error);
  }
}
