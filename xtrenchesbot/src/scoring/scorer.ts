import { getTokenData, getTopHolders, getTokenMetadata } from '../services';

export interface TokenScore {
  score: number;
  signals: string[];
  warnings: string[];
  isHighGamble: boolean;
}

interface ScoringData {
  marketCap: number;
  volume24h: number;
  liquidity: number;
  priceChange1h: number;
  buysSells1h: { buys: number; sells: number };
  top10HoldersPercent: number;
  devWalletPercent: number;
  ageMinutes: number;
}

/**
 * Calculate entry score for token
 * Higher score = better entry signal
 */
export async function calculateEntryScore(tokenAddress: string): Promise<TokenScore> {
  const signals: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  let isHighGamble = false;
  
  // Fetch data
  const dexData = await getTokenData(tokenAddress);
  const holders = await getTopHolders(tokenAddress);
  
  if (!dexData) {
    return { score: 0, signals: [], warnings: ['No DEX data found'], isHighGamble: true };
  }
  
  const data: ScoringData = {
    marketCap: dexData.marketCap || dexData.fdv || 0,
    volume24h: dexData.volume?.h24 || 0,
    liquidity: dexData.liquidity?.usd || 0,
    priceChange1h: dexData.priceChange?.h1 || 0,
    buysSells1h: dexData.txns?.h1 || { buys: 0, sells: 0 },
    top10HoldersPercent: holders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0),
    devWalletPercent: holders[0]?.percentage || 0,
    ageMinutes: dexData.pairCreatedAt 
      ? (Date.now() - dexData.pairCreatedAt) / (1000 * 60) 
      : Infinity,
  };
  
  // HIGH GAMBLE override
  if (data.ageMinutes < 10 && data.liquidity < 3000) {
    isHighGamble = true;
    warnings.push('HIGH GAMBLE: Age < 10min + Liq < $3k');
  }
  
  // Scoring rules
  // +15 if MC < 150k
  if (data.marketCap > 0 && data.marketCap < 150000) {
    score += 15;
    signals.push('Low MC (<$150k): +15');
  }
  
  // +20 if Volume/MC > 0.6
  if (data.marketCap > 0) {
    const volMcRatio = data.volume24h / data.marketCap;
    if (volMcRatio > 0.6) {
      score += 20;
      signals.push(`High Vol/MC (${(volMcRatio * 100).toFixed(0)}%): +20`);
    }
  }
  
  // +10 if 1h change > 10%
  if (data.priceChange1h > 10) {
    score += 10;
    signals.push(`1h pump (+${data.priceChange1h.toFixed(1)}%): +10`);
  }
  
  // +10 if Buy/Sell ratio > 1.2
  if (data.buysSells1h.sells > 0) {
    const buySellRatio = data.buysSells1h.buys / data.buysSells1h.sells;
    if (buySellRatio > 1.2) {
      score += 10;
      signals.push(`Bullish flow (${buySellRatio.toFixed(2)}x): +10`);
    }
  }
  
  // +15 if LP/MC > 15%
  if (data.marketCap > 0) {
    const lpMcRatio = (data.liquidity / data.marketCap) * 100;
    if (lpMcRatio > 15) {
      score += 15;
      signals.push(`Strong LP (${lpMcRatio.toFixed(1)}%): +15`);
    }
  }
  
  // +10 if Top10 holders < 35%
  if (data.top10HoldersPercent < 35) {
    score += 10;
    signals.push(`Distributed (Top10: ${data.top10HoldersPercent.toFixed(1)}%): +10`);
  } else if (data.top10HoldersPercent > 60) {
    warnings.push(`Concentrated supply: Top10 hold ${data.top10HoldersPercent.toFixed(1)}%`);
  }
  
  // +10 if Dev wallet < 5%
  if (data.devWalletPercent < 5) {
    score += 10;
    signals.push(`Low dev bag (${data.devWalletPercent.toFixed(1)}%): +10`);
  } else if (data.devWalletPercent > 20) {
    warnings.push(`Heavy dev bag: ${data.devWalletPercent.toFixed(1)}%`);
  }
  
  // +10 if Age < 2h
  if (data.ageMinutes < 120 && data.ageMinutes > 10) {
    score += 10;
    signals.push(`Fresh token (${Math.floor(data.ageMinutes)}min): +10`);
  }
  
  return { score, signals, warnings, isHighGamble };
}

/**
 * Format score for display
 */
export function formatScoreMessage(
  tokenSymbol: string,
  tokenName: string,
  score: TokenScore,
  dexData: any
): string {
  const lines: string[] = [];
  
  lines.push(`SCAN: ${tokenSymbol}`);
  lines.push(`${tokenName}`);
  lines.push('');
  
  // Price and metrics
  if (dexData) {
    lines.push(`MC: $${formatNumber(dexData.marketCap || dexData.fdv || 0)}`);
    lines.push(`Liq: $${formatNumber(dexData.liquidity?.usd || 0)}`);
    lines.push(`Vol 24h: $${formatNumber(dexData.volume?.h24 || 0)}`);
    lines.push(`Price: $${dexData.priceUsd || '0'}`);
    lines.push('');
  }
  
  // Score
  lines.push(`ENTRY SCORE: ${score.score}/100`);
  lines.push('');
  
  // Signals
  if (score.signals.length > 0) {
    lines.push('Signals:');
    for (const signal of score.signals) {
      lines.push(`  ${signal}`);
    }
    lines.push('');
  }
  
  // Warnings
  if (score.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of score.warnings) {
      lines.push(`  ${warning}`);
    }
    lines.push('');
  }
  
  // High gamble flag
  if (score.isHighGamble) {
    lines.push('HIGH GAMBLE');
    lines.push('Size accordingly or sit out.');
  } else if (score.score >= 70) {
    lines.push('Strong setup.');
  } else if (score.score >= 50) {
    lines.push('Decent setup.');
  } else {
    lines.push('Weak setup. Proceed with caution.');
  }
  
  return lines.join('\n');
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toFixed(2);
}
