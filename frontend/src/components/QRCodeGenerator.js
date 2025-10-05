import React from 'react';
import QRCode from 'qrcode.react';

const QRCodeGenerator = ({ walletAddress, amount, currency }) => {
  if (!walletAddress || !amount) return null;

  // Format the data to include both address and amount
  const qrData = `${currency.toUpperCase()}:${walletAddress}?amount=${amount}`;

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
        <p>Scan to deposit {amount} {currency.toUpperCase()}</p>
        <p className="wallet-address">{walletAddress}</p>
      </div>
    </div>
  );
};

export default QRCodeGenerator;