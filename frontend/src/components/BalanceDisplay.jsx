import React, { useEffect, useState } from 'react';
import apiService from '../services/api';

const BalanceDisplay = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ balance: 0, balanceBonus: 0, wageringRequired: 0, wageringProgress: 0 });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await apiService.getBalance();
        if (!mounted) return;
        setData(resp.data || {});
      } catch (e) {
        setError('Failed to load balance');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div>Loading balance...</div>;
  if (error) return <div>{error}</div>;

  const wr = Number(data.wageringRequired || 0);
  const wp = Number(data.wageringProgress || 0);
  const wrRemaining = Math.max(wr - wp, 0);
  const wrComplete = wr > 0 ? wp >= wr : true;

  const pct = wr > 0 ? Math.min(Math.round((wp / wr) * 100), 100) : 100;
  
  const realBalance = Number(data.balance || 0);
  const bonusBalance = Number(data.balanceBonus || 0);
  const totalBalance = realBalance + bonusBalance;

  return (
    <div className="wallet-card balance-display-card">
      <div className="balance-row total">
        <span className="label">Total</span>
        <span className="value">${totalBalance.toFixed(2)}</span>
      </div>
      <div className="balance-row real">
        <span className="label">Real</span>
        <span className="value">${realBalance.toFixed(2)}</span>
      </div>
      <div className="balance-row bonus">
        <span className="label">Bonus</span>
        <span className="value"><span className="bonus-badge">${bonusBalance.toFixed(2)}</span></span>
      </div>
      <div className="wr-progress">
        <div className="wr-bar">
          <div className="wr-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="wr-label">${wp.toFixed(2)} / ${wr.toFixed(2)} {wrComplete ? 'Complete' : `${pct}%`}</div>
      </div>
    </div>
  );
};

export default BalanceDisplay;
