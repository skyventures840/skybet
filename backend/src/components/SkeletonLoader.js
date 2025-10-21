import React from 'react';

const SkeletonLoader = ({ 
  type = 'match-card', 
  count = 1, 
  title = null,
  className = '',
  style = {} 
}) => {
  const renderMatchCardSkeleton = () => (
    <div className="match-card skeleton" style={{ padding: 16, ...style }}>
      <div className="skeleton-line" style={{ width: '50%', height: 16, marginBottom: 10 }}></div>
      <div className="skeleton-line" style={{ width: '70%', height: 12, marginBottom: 12 }}></div>
      <div className="skeleton-odds"></div>
      <div className="skeleton-odds"></div>
      <div className="skeleton-odds"></div>
    </div>
  );

  const renderPopularMatchSkeleton = () => (
    <div className="skeleton" style={{ padding: 12, ...style }}>
      <div className="skeleton-line" style={{ width: '55%', height: 14, marginBottom: 8 }}></div>
      <div className="skeleton-line" style={{ width: '75%', height: 12, marginBottom: 10 }}></div>
      <div className="skeleton-odds"></div>
    </div>
  );

  const renderGenericSkeleton = () => (
    <div className={`skeleton ${className}`} style={style}>
      <div className="skeleton-line" style={{ width: '60%', height: 16, marginBottom: 8 }}></div>
      <div className="skeleton-line" style={{ width: '80%', height: 12, marginBottom: 8 }}></div>
      <div className="skeleton-line" style={{ width: '40%', height: 12 }}></div>
    </div>
  );

  const getSkeleton = () => {
    switch (type) {
      case 'match-card':
        return renderMatchCardSkeleton();
      case 'popular-match':
        return renderPopularMatchSkeleton();
      case 'generic':
      default:
        return renderGenericSkeleton();
    }
  };

  if (type === 'popular-matches') {
    return (
      <div className="popular-matches">
        {title && <h2 className="section-title">{title}</h2>}
        <div className="matches-skeleton-grid">
          {Array.from({ length: count }).map((_, idx) => (
            <div key={idx}>
              {renderPopularMatchSkeleton()}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (count === 1) {
    return getSkeleton();
  }

  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx}>
          {getSkeleton()}
        </div>
      ))}
    </div>
  );
};

export default SkeletonLoader;