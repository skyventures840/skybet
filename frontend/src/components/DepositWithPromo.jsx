import React, { useState } from 'react';
import apiService from '../services/api';

const DepositWithPromo = () => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('card');
  const [currency, setCurrency] = useState('USD');
  const [promoCode, setPromoCode] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setStatus('Processing...');
    try {
      const resp = await apiService.deposit({ amount: Number(amount), method, currency, promoCode, referralCode });
      setStatus(JSON.stringify(resp.data));
    } catch (err) {
      setError(err?.response?.data?.error || 'Deposit failed');
      setStatus(null);
    }
  };

  return (
    <form onSubmit={submit} className="deposit-with-promo-form">
      <div>
        <label>Amount</label>
        <input type="number" min="10" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label>Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="card">Card</option>
          <option value="bank">Bank</option>
          <option value="crypto">Crypto</option>
        </select>
      </div>
      <div>
        <label>Currency</label>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="BTC">BTC</option>
          <option value="ETH">ETH</option>
          <option value="USDT">USDT</option>
        </select>
      </div>
      <div>
        <label>Promo Code</label>
        <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="WELCOME100 or REF50" />
      </div>
      <div>
        <label>Referral Code</label>
        <input type="text" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="Friend's referral code" />
      </div>
      <button type="submit">Deposit</button>
      {error && <div className="error">{error}</div>}
      {status && <pre className="status">{status}</pre>}
    </form>
  );
};

export default DepositWithPromo;

