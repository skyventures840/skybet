
import QRCode from 'qrcode';

export function generateCryptoQR(payAddress, payCurrency, amount = null, extraId = null) {
  let uri;
  const cur = String(payCurrency || '').toLowerCase();
  switch (cur) {
    case 'btc': {
      uri = `bitcoin:${payAddress}`;
      if (amount) uri += `?amount=${amount}`;
      if (extraId) uri += `${amount ? '&' : '?'}label=${extraId}`; // Use label for memos if needed
      break;
    }
    case 'eth': {
      uri = `ethereum:${payAddress}`;
      if (amount) uri += `?value=${parseFloat(amount) * 1e18}`; // Wei
      break;
    }
    case 'xrp': {
      uri = `xrp:${payAddress}`;
      if (extraId) uri += `?dt=${extraId}`;
      if (amount) uri += `${extraId ? '&' : '?'}amount=${parseFloat(amount) * 1e6}`; // Drops
      break;
    }
    case 'xlm': {
      uri = `web+stellar:pay?destination=${payAddress}`;
      if (extraId) uri += `&memo=${extraId}`;
      if (amount) uri += `&amount=${amount}`;
      break;
    }
    case 'usdt': {
      // USDT is an ERC-20 token on Ethereum, use EIP-681 standard
      const USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const units = Math.floor(parseFloat(amount || 0) * 1e6); // USDT has 6 decimals
      uri = `ethereum:${USDT_CONTRACT}@1/transfer?address=${payAddress}&uint256=${units}`;
      break;
    }
    // Add cases for LTC, DASH, etc., per earlier table
    default: {
      throw new Error('Unsupported currency');
    }
  }
  return uri;
}

export async function generateCryptoQrDataUrl(uriOrParams, options = { errorCorrectionLevel: 'H' }) {
  const uri = typeof uriOrParams === 'string'
    ? uriOrParams
    : generateCryptoQR(
        uriOrParams.payAddress,
        uriOrParams.payCurrency,
        uriOrParams.amount,
        uriOrParams.extraId,
      );
  return QRCode.toDataURL(uri, options);
}