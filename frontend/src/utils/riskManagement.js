const DISABLE_ODDS_LOCK = process.env.REACT_APP_DISABLE_ODDS_LOCK === 'true';

export const RISK_THRESHOLDS = {
  // Minimum odds allowed (below this is risky): relax slightly to avoid over-locking
  MIN_ODDS: 1.11,
  
  MAX_ODDS: 50.0,
  
  LIVE_RISK_MULTIPLIER: 1.5,
  
  LIVE_SCORE_DIFFERENCE_THRESHOLD: 3,
  
  LIVE_TIME_THRESHOLD_MINUTES: 10,
  
  OBVIOUS_WIN_THRESHOLD: 1.11,
  OBVIOUS_LOSS_THRESHOLD: 50.0,
};

/**
 * Check if odds are too low (high risk)
 * @param {number} odds - The odds value
 * @returns {boolean} - True if odds are too low
 */
export const isOddsTooLow = (odds) => {
  if (!odds || typeof odds !== 'number') return false;
  return odds < RISK_THRESHOLDS.MIN_ODDS;
};

/**
 * Check if odds are too high (too obvious)
 * @param {number} odds - The odds value
 * @returns {boolean} - True if odds are too high
 */
export const isOddsTooHigh = (odds) => {
  if (!odds || typeof odds !== 'number') return false;
  return odds > RISK_THRESHOLDS.MAX_ODDS;
};

/**
 * Check if live match has obvious outcome based on score
 * @param {Object} match - Match object
 * @returns {boolean} - True if outcome is too obvious
 */
export const isLiveMatchObvious = (match) => {
  if (!match.isLive && match.status !== 'live') return false;
  
  if (match.homeScore !== undefined && match.awayScore !== undefined) {
    const scoreDiff = Math.abs(match.homeScore - match.awayScore);
    if (scoreDiff >= RISK_THRESHOLDS.LIVE_SCORE_DIFFERENCE_THRESHOLD) {
      return true;
    }
  }
  
  // Check if match is in final minutes
  if (match.startTime) {
    const startTime = new Date(match.startTime);
    const now = new Date();
    const matchDuration = 90; // Assuming 90 minutes for soccer
    const elapsedMinutes = (now - startTime) / (1000 * 60);
    const remainingMinutes = matchDuration - elapsedMinutes;
    
    if (remainingMinutes <= RISK_THRESHOLDS.LIVE_TIME_THRESHOLD_MINUTES) {
      return true;
    }
  }
  
  return false;
};

/**
 * Check if odds represent an obvious outcome
 * @param {number} odds - The odds value
 * @returns {boolean} - True if outcome is too obvious
 */
export const isObviousOutcome = (odds) => {
  if (!odds || typeof odds !== 'number') return false;
  
  // Only very low odds (below 1.14) are considered risky
  if (odds <= RISK_THRESHOLDS.OBVIOUS_WIN_THRESHOLD) return true;
  
  return false;
};

/**
 * Main function to determine if odds should be disabled
 * @param {Object} match - Match object
 * @param {number} odds - The odds value
 * @param {string} oddsType - Type of odds (1, X, 2, etc.)
 * @returns {Object} - Risk assessment result
 */
export const assessOddsRisk = (match, odds, oddsType) => {
  // Environment override to never lock odds (useful for production hosting issues)
  if (DISABLE_ODDS_LOCK) {
    return {
      shouldDisable: false,
      reason: null,
      riskLevel: 'none',
      riskFactors: []
    };
  }

  if (!odds || typeof odds !== 'number') {
    return {
      shouldDisable: false,
      reason: null,
      riskLevel: 'none'
    };
  }
  
  const riskFactors = [];
  let riskLevel = 'low';
  
  // Check if odds are too low
  if (isOddsTooLow(odds)) {
    riskFactors.push('odds_too_low');
    riskLevel = 'high';
  }
  
  // Check if outcome is too obvious (only low odds below 1.14 are considered risky)
  if (isObviousOutcome(odds)) {
    riskFactors.push('obvious_outcome');
    riskLevel = 'high';
  }
  
  // Check live match specific risks
  if (match.isLive || match.status === 'live') {
    if (isLiveMatchObvious(match)) {
      riskFactors.push('live_match_obvious');
      riskLevel = 'high';
    } else {
      riskLevel = 'medium'; // Live matches are inherently riskier
    }
  }
  
  // Check for specific odds type risks
  if (oddsType === 'X' && odds < 1.50) {
    // Draw odds below 1.50 are suspicious
    riskFactors.push('suspicious_draw_odds');
    riskLevel = 'medium';
  }
  
  // Only lock live odds for truly high-risk scenarios
  const isLive = match?.isLive || match?.status === 'live';
  let shouldDisable;
  if (isLive) {
    // For live matches, disable ONLY when the live state is obviously risky
    // i.e., outcome is obvious based on score/time
    shouldDisable = riskFactors.includes('live_match_obvious');
  } else {
    // Pre-match: disable when overall risk is high
    shouldDisable = riskLevel === 'high';
  }

  return {
    shouldDisable,
    reason: riskFactors.length > 0 ? riskFactors.join(', ') : null,
    riskLevel,
    riskFactors
  };
};

/**
 * Get risk level display text
 * @param {string} riskLevel - Risk level
 * @returns {string} - Display text
 */
export const getRiskLevelText = (riskLevel) => {
  switch (riskLevel) {
    case 'high':
      return 'High Risk - Odds Disabled';
    case 'medium':
      return 'Medium Risk';
    case 'low':
      return 'Low Risk';
    default:
      return 'Unknown Risk';
  }
};

/**
 * Get risk reason display text
 * @param {Array} riskFactors - Array of risk factors
 * @returns {string} - Human readable risk reason
 */
export const getRiskReasonText = (riskFactors) => {
  if (!riskFactors || riskFactors.length === 0) return '';
  
  const reasonMap = {
    'odds_too_low': 'Odds too low',
    'obvious_outcome': 'Odds too low (below 1.11)',
    'live_match_obvious': 'Live match outcome obvious',
    'suspicious_draw_odds': 'Suspicious draw odds'
  };
  
  return riskFactors.map(factor => reasonMap[factor] || factor).join(', ');
};
