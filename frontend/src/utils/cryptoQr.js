// Crypto payment URI builder and QR data URL generator
// Implements user-provided schemes for BTC, ETH, XRP, XLM
// Usage example:
// import { generateCryptoQR, generateCryptoQrDataUrl } from './cryptoQr';
// const uri = generateCryptoQR('rYourXRPAddressHere', 'XRP', '10.5', '123456789');
// const dataUrl = await generateCryptoQrDataUrl(uri);

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