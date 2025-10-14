import React from 'react';

const MatchCardSkeleton = () => {
  return (
    <div className="match-card skeleton" style={{ padding: 16 }}>
      <div className="skeleton-line" style={{ width: '50%', height: 16, marginBottom: 10 }}></div>
      <div className="skeleton-line" style={{ width: '70%', height: 12, marginBottom: 12 }}></div>
      <div className="skeleton-odds"></div>
      <div className="skeleton-odds"></div>
      <div className="skeleton-odds"></div>
    </div>
  );
};

export default MatchCardSkeleton;