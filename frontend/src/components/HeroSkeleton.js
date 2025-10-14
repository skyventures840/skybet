import React from 'react';

const HeroSkeleton = () => {
  return (
    <div className="hero-skeleton" aria-label="Loading hero banner">
      <div className="skeleton-line" style={{ width: '40%', height: 24, marginBottom: 12 }}></div>
      <div className="skeleton-line" style={{ width: '60%', height: 16, marginBottom: 8 }}></div>
      <div className="skeleton-line" style={{ width: '30%', height: 12 }}></div>
    </div>
  );
};

export default HeroSkeleton;