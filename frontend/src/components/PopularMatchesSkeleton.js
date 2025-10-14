import React from 'react';

const PopularMatchesSkeleton = () => {
  return (
    <div className="popular-matches">
      <h2 className="section-title">Popular Matches</h2>
      <div className="matches-skeleton-grid">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="skeleton" style={{ padding: 12 }}>
            <div className="skeleton-line" style={{ width: '55%', height: 14, marginBottom: 8 }}></div>
            <div className="skeleton-line" style={{ width: '75%', height: 12, marginBottom: 10 }}></div>
            <div className="skeleton-odds"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PopularMatchesSkeleton;