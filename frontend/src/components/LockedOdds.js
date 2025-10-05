import React from 'react';

const LockedOdds = ({ 
  riskAssessment, 
  className = '' 
}) => {
  const { shouldDisable } = riskAssessment;
  
  if (!shouldDisable) {
    return null;
  }
  
  return (
    <div 
      className={`locked-odds ${className}`}
      title="Odds Unavailable"
    >
      {/* Lock Icon Only - Perfectly Centered */}
      <div className="lock-icon">
        🔒
      </div>
    </div>
  );
};

export default LockedOdds;
