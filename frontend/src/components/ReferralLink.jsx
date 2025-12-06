import React, { useEffect, useState } from 'react';
import apiService from '../services/api';

const ReferralLink = () => {
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const resp = await apiService.getUserProfile();
        const code = resp?.data?.referralCode || '';
        setReferralCode(code);
      } catch {}
    })();
  }, []);

  const referralUrl = `${window.location.origin}/signup?ref=${encodeURIComponent(referralCode || '')}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (!referralCode) return <div>Loading referral code...</div>;

  return (
    <div className="referral-link-card">
      <div><strong>Your Referral Code:</strong> {referralCode}</div>
      <div className="ref-url">{referralUrl}</div>
      <button onClick={copy}>{copied ? 'Copied!' : 'Copy Referral Link'}</button>
    </div>
  );
};

export default ReferralLink;

