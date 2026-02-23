import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';

interface PnlCardData {
  tokenName: string;
  tokenSymbol: string;
  entryPrice: number;
  currentPrice: number;
  pnlPercent: number;
  pnlSol: number;
}

const ASSETS_DIR = path.resolve(__dirname, '../../assets');

/**
 * Generate PNL card image
 */
export async function generatePnlCard(data: PnlCardData): Promise<Buffer> {
  // Select template based on PNL
  let templateFile: string;
  let tagline: string;
  
  if (data.pnlPercent < 0) {
    templateFile = 'pnl_red.png';
    tagline = 'You got farmed.';
  } else if (data.pnlPercent < 30) {
    templateFile = 'pnl_neutral.png';
    tagline = "Still cooking. Don't fumble.";
  } else {
    templateFile = 'pnl_green.png';
    tagline = 'PRINTING. Take partials or regret.';
  }
  
  const templatePath = path.join(ASSETS_DIR, templateFile);
  
  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    throw new Error(`PNL template not found: ${templateFile}`);
  }
  
  // Load template image
  const template = await loadImage(templatePath);
  
  // Create canvas with 16:9 ratio
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Draw template (scaled to fit)
  ctx.drawImage(template, 0, 0, width, height);
  
  // Add semi-transparent overlay for text readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, width, height);
  
  // Configure text styling
  ctx.textBaseline = 'top';
  
  // Helper for drop shadow
  const drawTextWithShadow = (
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: string = '#FFFFFF',
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = align;
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(text, x + 3, y + 3);
    
    // Main text
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };
  
  // TOP LEFT: Token name
  drawTextWithShadow(data.tokenSymbol, 50, 50, 48);
  drawTextWithShadow(data.tokenName, 50, 110, 28, '#CCCCCC');
  
  // BELOW: Entry and current price
  drawTextWithShadow(`Entry: $${formatPrice(data.entryPrice)}`, 50, 170, 24, '#AAAAAA');
  drawTextWithShadow(`Now: $${formatPrice(data.currentPrice)}`, 50, 210, 24, '#AAAAAA');
  
  // CENTER: Large PNL %
  const pnlColor = data.pnlPercent >= 0 ? '#00FF88' : '#FF4444';
  const pnlSign = data.pnlPercent >= 0 ? '+' : '';
  const pnlText = `${pnlSign}${data.pnlPercent.toFixed(2)}%`;
  drawTextWithShadow(pnlText, width / 2, height / 2 - 60, 96, pnlColor, 'center');
  
  // BELOW CENTER: SOL amount
  const solSign = data.pnlSol >= 0 ? '+' : '';
  const solText = `${solSign}${data.pnlSol.toFixed(4)} SOL`;
  drawTextWithShadow(solText, width / 2, height / 2 + 60, 36, pnlColor, 'center');
  
  // BOTTOM: Tagline
  drawTextWithShadow(tagline, width / 2, height - 80, 28, '#FFFFFF', 'center');
  
  // BOTTOM RIGHT: Branding
  drawTextWithShadow('XTRENCHESBOT', width - 50, height - 40, 18, '#666666', 'right');
  
  // Export as PNG buffer
  return canvas.toBuffer('image/png');
}

function formatPrice(price: number): string {
  if (price < 0.00001) return price.toExponential(4);
  if (price < 0.01) return price.toFixed(8);
  if (price < 1) return price.toFixed(6);
  if (price < 100) return price.toFixed(4);
  return price.toFixed(2);
}
