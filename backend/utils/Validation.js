const validateMultiBet = (data) => {
  const errors = [];
  
  // Check required fields
  if (!data.matches || !Array.isArray(data.matches)) {
    errors.push('Matches array is required');
    return { isValid: false, errors };
  }
  
  if (data.matches.length < 2) {
    errors.push('At least 2 matches are required for a multi-bet');
  }
  
  if (data.matches.length > 20) {
    errors.push('Maximum 20 matches allowed per multi-bet');
  }
  
  if (!data.stake || typeof data.stake !== 'number' || data.stake <= 0) {
    errors.push('Valid stake amount is required');
  }
  
  if (data.stake < 0.01) {
    errors.push('Minimum stake is $0.01');
  }
  
  if (data.stake > 10000) {
    errors.push('Maximum stake is $10,000');
  }
  
  // Validate each match
  data.matches.forEach((match, index) => {
    if (!match.matchId) {
      errors.push(`Match ${index + 1}: Match ID is required`);
    }
    
    if (!match.homeTeam || !match.awayTeam) {
      errors.push(`Match ${index + 1}: Both teams are required`);
    }
    
    if (!match.league) {
      errors.push(`Match ${index + 1}: League is required`);
    }
    
    if (!match.startTime) {
      errors.push(`Match ${index + 1}: Start time is required`);
    }
    
    if (!match.outcome || !['1', 'X', '2'].includes(match.outcome)) {
      errors.push(`Match ${index + 1}: Valid outcome (1, X, 2) is required`);
    }
    
    if (!match.odds || typeof match.odds !== 'number' || match.odds < 1.01) {
      errors.push(`Match ${index + 1}: Valid odds (≥1.01) are required`);
    }
    
    if (match.odds > 1000) {
      errors.push(`Match ${index + 1}: Maximum odds allowed is 1000`);
    }
    
    // Check if match start time is in the future
    const matchTime = new Date(match.startTime);
    const now = new Date();
    if (matchTime <= now) {
      errors.push(`Match ${index + 1}: Match must start in the future`);
    }
  });
  
  // Check for duplicate matches
  const matchIds = data.matches.map(m => m.matchId);
  const uniqueMatchIds = new Set(matchIds);
  if (matchIds.length !== uniqueMatchIds.size) {
    errors.push('Duplicate matches are not allowed');
  }
  
  // Validate currency
  if (data.currency && !['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(data.currency)) {
    errors.push('Invalid currency. Supported: USD, EUR, GBP, CAD, AUD');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateStake = (stake, minStake = 0.01, maxStake = 10000) => {
  const errors = [];
  
  if (!stake || typeof stake !== 'number') {
    errors.push('Stake must be a valid number');
  } else {
    if (stake < minStake) {
      errors.push(`Minimum stake is $${minStake}`);
    }
    
    if (stake > maxStake) {
      errors.push(`Maximum stake is $${maxStake}`);
    }
    
    if (stake % 0.01 !== 0) {
      errors.push('Stake must be in increments of $0.01');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateOdds = (odds) => {
  const errors = [];
  
  if (!odds || typeof odds !== 'number') {
    errors.push('Odds must be a valid number');
  } else {
    if (odds < 1.01) {
      errors.push('Odds must be at least 1.01');
    }
    
    if (odds > 1000) {
      errors.push('Odds cannot exceed 1000');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateMatchSelection = (match, selectedOutcome) => {
  const errors = [];
  
  if (!match) {
    errors.push('Match is required');
  }
  
  if (!selectedOutcome || !['1', 'X', '2'].includes(selectedOutcome)) {
    errors.push('Valid outcome selection is required');
  }
  
  if (match && match.startTime) {
    const matchTime = new Date(match.startTime);
    const now = new Date();
    if (matchTime <= now) {
      errors.push('Cannot bet on matches that have already started');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateMultiBet,
  validateStake,
  validateOdds,
  validateMatchSelection
};
