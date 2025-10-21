import React from 'react';
import QRCode from 'qrcode.react';

// Helper to convert a decimal string to an integer string with given decimals
function toUnit(amount, decimals) {
  const [whole = '0', frac = ''] = String(amount).split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const normalized = `${whole}${fracPadded}`.replace(/^0+/, '') || '0';
  return normalized;
}

// Build standardized crypto payment URIs
function buildPaymentUri({ currency, address, amount, memoTag }) {
  const cur = String(currency).toUpperCase();
  if (cur === 'ETH') {
    // EIP-681: value in wei, explicit mainnet chainId @1
    const wei = toUnit(amount, 18);
    return `ethereum:${address}@1?value=${wei}`;
  }
  if (cur === 'USDT') {
    // EIP-681 ERC20 transfer on Ethereum mainnet (USDT contract)
    const USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const units = toUnit(amount, 6);
    return `ethereum:${USDT_CONTRACT}@1/transfer?address=${address}&uint256=${units}`;
  }
  if (cur === 'USDC') {
    const USDC_CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9eB0cE3606eB48';
    const units = toUnit(amount, 6);
    return `ethereum:${USDC_CONTRACT}@1/transfer?address=${address}&uint256=${units}`;
  }
  if (cur === 'DAI') {
    const DAI_CONTRACT = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
    const units = toUnit(amount, 18);
    return `ethereum:${DAI_CONTRACT}@1/transfer?address=${address}&uint256=${units}`;
  }
  if (cur === 'LINK') {
    const LINK_CONTRACT = '0x514910771AF9Ca656af840dff83E8264EcF986CA';
    const units = toUnit(amount, 18);
    return `ethereum:${LINK_CONTRACT}@1/transfer?address=${address}&uint256=${units}`;
  }
  if (cur === 'BTC') {
    // BIP-21
    return `bitcoin:${address}?amount=${amount}`;
  }
  if (cur === 'LTC') {
    return `litecoin:${address}?amount=${amount}`;
  }
  if (cur === 'XRP') {
    // Common URI usage with destination tag (dt)
    const base = `ripple:${address}?amount=${amount}`;
    return memoTag ? `${base}&dt=${memoTag}` : base;
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
  if (cur === 'MATIC') {
    const wei = toUnit(amount, 18);
    return `ethereum:${address}@137?value=${wei}`;
  }
  if (cur === 'BNB') {
    const wei = toUnit(amount, 18);
    return `ethereum:${address}@56?value=${wei}`;
  }
  if (cur === 'DOT') {
    return `polkadot:${address}?amount=${amount}`;
  }
  if (cur === 'AVAX') {
    const wei = toUnit(amount, 18);
    return `ethereum:${address}@43114?value=${wei}`;
  }
  if (cur === 'XMR') {
    return `monero:${address}?amount=${amount}`;
  }
  if (cur === 'XLM') {
    return `web+stellar:pay?destination=${address}&amount=${amount}`;
  }
  if (cur === 'DASH') {
    return `dash:${address}?amount=${amount}`;
  }
  if (cur === 'ZEC') {
    return `zcash:${address}?amount=${amount}`;
  }
  // Fallback to scheme by currency
  return `${cur.toLowerCase()}:${address}?amount=${amount}`;
}

const QRCodeGenerator = ({ walletAddress, amount, currency, memoTag }) => {
  if (!walletAddress || !amount || !currency) return null;

  const qrData = buildPaymentUri({
    currency,
    address: walletAddress,
    amount,
    memoTag,
  });

  return (
    <div className="qr-code-container">
      <QRCode
        value={qrData}
        size={200}
        level="H"
        includeMargin={true}
        renderAs="svg"
      />
      <div className="qr-code-info">
        <p>Scan to deposit {amount} {String(currency).toUpperCase()}</p>
        <p className="wallet-address">{walletAddress}</p>
      </div>
    </div>
  );
};

export default QRCodeGenerator;