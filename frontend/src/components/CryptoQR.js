import React, { useEffect, useState } from 'react';
import { generateCryptoQR, generateCryptoQrDataUrl } from '../utils/cryptoQr';

// Renders a QR code <img> from a crypto payment URI using qrcode
// Props: address, currency, amount, extraId, size
const CryptoQR = ({ address, currency, amount = null, extraId = null, size = 220 }) => {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function build() {
      try {
        const uri = generateCryptoQR(address, currency, amount, extraId);
        const url = await generateCryptoQrDataUrl(uri, { errorCorrectionLevel: 'H' });
        if (mounted) setDataUrl(url);
      } catch (err) {
        if (mounted) setError(err.message || String(err));
      }
    }
    if (address && currency) build();
    return () => { mounted = false; };
  }, [address, currency, amount, extraId]);

  if (!address || !currency) return null;
  if (error) return <div className="qr-error">QR error: {error}</div>;
  if (!dataUrl) return <div className="qr-loading">Generating QR…</div>;

  return (
    <img
      src={dataUrl}
      alt={`Scan to pay ${amount || ''} ${String(currency).toUpperCase()} to ${address}`}
      width={size}
      height={size}
      style={{ display: 'block', margin: '0 auto' }}
    />
  );
};

export default CryptoQR;