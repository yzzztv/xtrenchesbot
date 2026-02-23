/**
 * XTRENCHESBOT Message Templates
 * Centralized message formatting with consistent style
 */

// ============================================
// GENERAL TEMPLATES
// ============================================

export function errorMessage(customMsg?: string): string {
  return `Something went wrong.
${customMsg || 'Please try again in a moment.'}`;
}

export function notRegisteredMessage(): string {
  return `Not registered yet.
Use /start to create your wallet.`;
}

export function invalidAddressMessage(): string {
  return `Invalid contract address.
Check the format and try again.`;
}

// ============================================
// MENU TEMPLATES
// ============================================

export function mainMenuMessage(): string {
  return `Alpha Terminal
Smart tracking. Clean execution.

Select an option below.`;
}

export function walletManagerMessage(
  activeAddress: string,
  balance: number,
  totalWallets: number,
  maxWallets: number
): string {
  return `Wallet Manager

Active: ${activeAddress}
Balance: ${balance.toFixed(4)} SOL
Wallets: ${totalWallets}/${maxWallets}

Select an option:`;
}

export function settingsMessage(
  autoTp: boolean,
  autoSl: boolean,
  autoBuy: boolean
): string {
  return `Settings

Auto Take Profit: ${autoTp ? 'ON' : 'OFF'}
Auto Stop Loss: ${autoSl ? 'ON' : 'OFF'}
Auto Buy: ${autoBuy ? 'ON' : 'OFF'}

Use commands to toggle:
/tp on|off - Auto TP
/sl on|off - Auto SL
/setpin 1234 - Set PIN`;
}

// ============================================
// POSITION TEMPLATES
// ============================================

export function positionRecordedMessage(
  symbol: string,
  price: string,
  time: string,
  tokenAddress: string
): string {
  return `Position Recorded

Token: ${symbol}
Entry: ${price}
Time: ${time}

Use /pnl ${tokenAddress} to track performance.`;
}

export function positionExistsMessage(tokenAddress: string): string {
  return `Position already active for this token.

Use /pnl ${tokenAddress.slice(0, 8)}... to check performance.`;
}

export function noPositionsMessage(): string {
  return `No active positions yet.

Paste a contract address to record an entry.`;
}

export function positionsListMessage(positions: Array<{ symbol: string; address: string }>): string {
  const lines = ['Your Active Positions', ''];
  
  for (const pos of positions) {
    lines.push(`${pos.symbol} (${pos.address.slice(0, 6)}...)`);
  }
  
  lines.push('');
  lines.push(`Total: ${positions.length} position(s)`);
  
  return lines.join('\n');
}

// ============================================
// PNL TEMPLATES
// ============================================

export function pnlProfitMessage(
  symbol: string,
  entryPrice: string,
  currentPrice: string,
  percentage: number,
  solAmount?: number
): string {
  const solLine = solAmount !== undefined ? `\n+${solAmount.toFixed(4)} SOL` : '';
  
  return `Position Update
Token: ${symbol}

Entry: ${entryPrice}
Current: ${currentPrice}

+${percentage.toFixed(2)}%${solLine}

Keep riding the momentum.`;
}

export function pnlLossMessage(
  symbol: string,
  entryPrice: string,
  currentPrice: string,
  percentage: number,
  solAmount?: number
): string {
  const solLine = solAmount !== undefined ? `\n${solAmount.toFixed(4)} SOL` : '';
  
  return `Position Update
Token: ${symbol}

Entry: ${entryPrice}
Current: ${currentPrice}

${percentage.toFixed(2)}%${solLine}

Stay sharp. Markets move fast.`;
}

export function pnlNeutralMessage(
  symbol: string,
  entryPrice: string,
  currentPrice: string,
  percentage: number
): string {
  return `Position Update
Token: ${symbol}

Entry: ${entryPrice}
Current: ${currentPrice}

${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%

Still warming up.`;
}

export function noPnlPositionMessage(): string {
  return `No active position found for this contract address.

Paste a CA first to record entry.`;
}

export function pnlGeneratingMessage(status: string): string {
  return `Generating PNL card... ${status}`;
}

// ============================================
// WALLET TEMPLATES
// ============================================

export function walletCreatedMessage(address: string, shortAddress: string): string {
  return `New Wallet Created

Address: \`${address}\`
Short: ${shortAddress}

Keep your private key safe.`;
}

export function walletSwitchedMessage(shortAddress: string): string {
  return `Wallet switched successfully.

Active: ${shortAddress}`;
}

export function walletRemovedMessage(): string {
  return `Wallet removed successfully.`;
}

export function walletLimitMessage(maxWallets: number): string {
  return `Wallet limit reached (${maxWallets} max).

Remove a wallet to add a new one.`;
}

export function walletExportPinPrompt(): string {
  return `Enter your 4-digit PIN to export private key:

Type your PIN below or "cancel" to abort.`;
}

export function walletExportSuccess(privateKey: string): string {
  return `Security Warning
Never share this key with anyone.
This message will be deleted.

Your Private Key:
\`${privateKey}\`

Save it securely NOW.`;
}

export function walletExportAutoDeleted(): string {
  return `Private key message auto-deleted for security.`;
}

export function walletExportDeleteFailed(): string {
  return `Could not auto-delete. Please delete the key message manually for security.`;
}

export function walletNoPinSet(): string {
  return `No PIN set.

Use /setpin 1234 to set a PIN first.`;
}

export function walletRemoveConfirm(shortAddress: string, isActive: boolean): string {
  const activeWarning = isActive ? '(This is your ACTIVE wallet)\n' : '';
  return `Are you sure?

Wallet: ${shortAddress}
${activeWarning}
This action cannot be undone.`;
}

export function walletCannotRemoveLast(): string {
  return `Cannot remove your only wallet.

Add another wallet first.`;
}

// ============================================
// TRADE TEMPLATES
// ============================================

export function buyExecutedMessage(
  symbol: string,
  amountSol: number,
  signature: string
): string {
  return `Buy Executed

Token: ${symbol}
Amount: ${amountSol.toFixed(4)} SOL
Tx: \`${signature.slice(0, 16)}...\`

Position open. Watch it or set TP/SL.`;
}

export function sellExecutedMessage(
  percent: number,
  pnlPercent: number,
  pnlSol: number,
  signature: string
): string {
  const pnlSign = pnlSol >= 0 ? '+' : '';
  const outcome = pnlSol >= 0 ? 'Profit secured.' : 'Loss cut. Move on.';
  
  return `Sell Executed

Sold: ${percent}%
PNL: ${pnlSign}${pnlPercent.toFixed(2)}% (${pnlSign}${pnlSol.toFixed(4)} SOL)
Tx: \`${signature.slice(0, 16)}...\`

${outcome}`;
}

export function tradeRateLimitMessage(): string {
  return `Slow down soldier.

Too many trades. Wait a moment.`;
}

export function insufficientBalanceMessage(have: number, need: number): string {
  return `Insufficient balance.

Have: ${have.toFixed(4)} SOL
Need: ${need.toFixed(4)} SOL`;
}

// ============================================
// SCAN TEMPLATES
// ============================================

export function scanningMessage(): string {
  return `Scanning token...`;
}

export function scanNotFoundMessage(): string {
  return `Token not found on DEX.

Might be too new or no liquidity.`;
}

export function scanResultMessage(
  symbol: string,
  name: string,
  marketCap: string,
  liquidity: string,
  volume24h: string,
  price: string,
  score: number,
  signals: string[],
  warnings: string[],
  verdict: string
): string {
  const lines = [
    `Scan: ${symbol}`,
    name,
    '',
    `MC: $${marketCap}`,
    `Liq: $${liquidity}`,
    `Vol 24h: $${volume24h}`,
    `Price: $${price}`,
    '',
    `Entry Score: ${score}/100`,
  ];
  
  if (signals.length > 0) {
    lines.push('', 'Signals:');
    for (const signal of signals) {
      lines.push(`  ${signal}`);
    }
  }
  
  if (warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of warnings) {
      lines.push(`  ${warning}`);
    }
  }
  
  lines.push('', verdict);
  
  return lines.join('\n');
}

// ============================================
// WITHDRAW TEMPLATES
// ============================================

export function withdrawRequestMessage(amount: number, destination: string): string {
  return `Withdrawal Request

Amount: ${amount.toFixed(4)} SOL
To: \`${destination}\`

Reply with your 4-digit PIN to confirm.
Or type 'cancel' to abort.`;
}

export function withdrawSuccessMessage(amount: number, destination: string, signature: string): string {
  return `Withdrawal Complete

Amount: ${amount.toFixed(4)} SOL
To: \`${destination}\`
Tx: \`${signature.slice(0, 16)}...\`

Funds sent.`;
}

export function withdrawCancelledMessage(): string {
  return `Withdrawal cancelled.`;
}

export function withdrawExpiredMessage(): string {
  return `Withdrawal expired. Start again with /withdraw`;
}

// ============================================
// PIN TEMPLATES
// ============================================

export function pinSetSuccess(): string {
  return `PIN set successfully.

Don't forget it. Required for withdrawals.`;
}

export function pinIncorrect(): string {
  return `Incorrect PIN.`;
}

// ============================================
// START/WELCOME TEMPLATES
// ============================================

export function welcomeMessage(
  walletAddress: string,
  balance: number,
  minTrade: number,
  minBuy: number
): string {
  return `Welcome to the trenches.

Send SOL to this war wallet:
\`${walletAddress}\`

Balance: ${balance.toFixed(4)} SOL
Minimum to fight: ${minTrade} SOL
Minimum buy: ${minBuy} SOL

You're not here to spectate.

Commands:
/buy <CA> <SOL> - Enter position
/sell <CA> <%> - Exit position
/positions - View open trades
/pnl <CA> - View PNL card
/scan <CA> - Analyze token
/withdraw <SOL> - Withdraw funds
/setpin <4 digits> - Set PIN
/settings - View settings
/menu - Main menu`;
}

export function helpMessage(maxUsers: number, feePercent: number, tpPercent: number, slPercent: number): string {
  return `XTRENCHESBOT Commands

Trading:
/buy <CA> <SOL> - Buy token
/sell <CA> <%> - Sell token (default: 100%)

Portfolio:
/positions - Open positions
/pnl <CA> - Generate PNL card
/balance - Check wallet balance

Analysis:
/scan <CA> - Token entry score

Wallet:
/withdraw <SOL> <addr> - Withdraw to external
/setpin <4 digits> - Set/change PIN

Settings:
/settings - View current settings
/tp on|off - Auto take profit
/sl on|off - Auto stop loss

Beta Info:
Max ${maxUsers} users
${feePercent}% fee
TP: +${tpPercent}%
SL: ${slPercent}%

WAGMI`;
}

// ============================================
// TP/SL TEMPLATES
// ============================================

export function tpSlToggleMessage(type: 'TP' | 'SL', enabled: boolean, percent: number): string {
  const label = type === 'TP' ? 'Auto Take Profit' : 'Auto Stop Loss';
  const trigger = type === 'TP' ? `+${percent}%` : `${percent}%`;
  const hint = enabled 
    ? 'Positions will auto-close at trigger.' 
    : (type === 'TP' ? 'Manual sell required.' : "Manual sell required. Don't fumble.");
  
  return `${label}: ${enabled ? 'ON' : 'OFF'}
Trigger: ${trigger}

${hint}`;
}

export function tpHitMessage(pnlPercent: number, pnlSol: number): string {
  return `TP HIT

Trade auto-closed.
PNL: +${pnlPercent.toFixed(2)}% (+${pnlSol.toFixed(4)} SOL)

You took profit. Good.`;
}

export function slHitMessage(pnlPercent: number, pnlSol: number): string {
  return `SL HIT

Trade auto-closed.
PNL: ${pnlPercent.toFixed(2)}% (${pnlSol.toFixed(4)} SOL)

Cut the loss. Move on.`;
}

// ============================================
// PRICE FORMATTING HELPERS
// ============================================

export function formatPrice(price: number): string {
  if (price < 0.00001) return price.toExponential(4);
  if (price < 0.01) return price.toFixed(8);
  if (price < 1) return price.toFixed(6);
  if (price < 100) return price.toFixed(4);
  return price.toFixed(2);
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toFixed(2);
}

export function maskAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
