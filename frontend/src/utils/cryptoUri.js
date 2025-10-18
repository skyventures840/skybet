// Web3-friendly QR payment URI builder
// Supports EIP-681 for ETH/ERC-20 and common schemes for major chains.
import { ethers } from 'ethers';
import QRCode from 'qrcode';

// Convert decimal amount to integer units given token decimals
function toUnit(amount, decimals) {
  const [whole = '0', frac = ''] = String(amount ?? '0').split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const normalized = `${whole}${fracPadded}`.replace(/^0+/, '') || '0';
  return normalized;
}

// Attempt to checksum EVM addresses where applicable
function checksumIfEvm(address) {
  try {
    return ethers.utils.getAddress(address);
  } catch {
    return address; // Non-EVM or invalid, return as-is
  }
}

// Build standardized crypto payment URIs
export function buildPaymentUri({ currency, address, amount, memoTag }) {
  const cur = String(currency || '').toUpperCase();
  const addr = checksumIfEvm(String(address || ''));

  if (!cur || !addr) return '';

  // EVM chains and ERC-20 via EIP-681
  if (cur === 'ETH') {
    const wei = toUnit(amount, 18);
    return `ethereum:${addr}@1?value=${wei}`;
  }
  if (cur === 'USDT') {
    const USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const units = toUnit(amount, 6);
    return `ethereum:${USDT_CONTRACT}@1/transfer?address=${addr}&uint256=${units}`;
  }
  if (cur === 'USDC') {
    const USDC_CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9eB0cE3606eB48';
    const units = toUnit(amount, 6);
    return `ethereum:${USDC_CONTRACT}@1/transfer?address=${addr}&uint256=${units}`;
  }
  if (cur === 'DAI') {
    const DAI_CONTRACT = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
    const units = toUnit(amount, 18);
    return `ethereum:${DAI_CONTRACT}@1/transfer?address=${addr}&uint256=${units}`;
  }
  if (cur === 'LINK') {
    const LINK_CONTRACT = '0x514910771AF9Ca656af840dff83E8264EcF986CA';
    const units = toUnit(amount, 18);
    return `ethereum:${LINK_CONTRACT}@1/transfer?address=${addr}&uint256=${units}`;
  }
  if (cur === 'MATIC') {
    const wei = toUnit(amount, 18);
    return `ethereum:${addr}@137?value=${wei}`; // Polygon
  }
  if (cur === 'BNB') {
    const wei = toUnit(amount, 18);
    return `ethereum:${addr}@56?value=${wei}`; // BSC
  }
  if (cur === 'AVAX') {
    const wei = toUnit(amount, 18);
    return `ethereum:${addr}@43114?value=${wei}`; // Avalanche C-Chain
  }

  // Bitcoin-family & other non-EVM chains
  if (cur === 'BTC') {
    return `bitcoin:${address}?amount=${amount}`; // BIP-21
  }
  if (cur === 'LTC') {
    return `litecoin:${address}?amount=${amount}`;
  }
  if (cur === 'DASH') {
    return `dash:${address}?amount=${amount}`;
  }
  if (cur === 'ZEC') {
    return `zcash:${address}?amount=${amount}`;
  }
  if (cur === 'DOGE') {
    return `dogecoin:${address}?amount=${amount}`;
  }
  if (cur === 'TRX') {
    return `tron:${address}?amount=${amount}`;
  }
  if (cur === 'ADA') {
    return `cardano:${address}?amount=${amount}`;
  }
  if (cur === 'SOL') {
    return `solana:${address}?amount=${amount}`;
  }
  if (cur === 'DOT') {
    return `polkadot:${address}?amount=${amount}`;
  }
  if (cur === 'XMR') {
    return `monero:${address}?amount=${amount}`;
  }
  if (cur === 'XLM') {
    // Stellar SEP-7 style
    return `web+stellar:pay?destination=${address}&amount=${amount}`;
  }
  if (cur === 'XRP') {
    const base = `ripple:${address}?amount=${amount}`;
    return memoTag ? `${base}&dt=${memoTag}` : base; // destination tag
  }

  // Fallback to scheme by currency
  return `${cur.toLowerCase()}:${address}?amount=${amount}`;
}

// QR Code generation functions (consolidated from cryptoQr.js)
export function generateCryptoQR(payAddress, payCurrency, amount = null, extraId = null) {
  return buildPaymentUri({
    currency: payCurrency,
    address: payAddress,
    amount: amount,
    memoTag: extraId
  });
}

export async function generateCryptoQrDataUrl(uriOrParams, options = { errorCorrectionLevel: 'H' }) {
  const uri = typeof uriOrParams === 'string'
    ? uriOrParams
    : generateCryptoQR(
        uriOrParams.payAddress,
        uriOrParams.payCurrency,
        uriOrParams.amount,
        uriOrParams.extraId
      );
  
  try {
    return await QRCode.toDataURL(uri, options);
  } catch (error) {
    console.error('QR Code generation failed:', error);
    throw error;
  }
}

export default buildPaymentUri;