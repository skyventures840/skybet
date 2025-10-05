import React, { useRef, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import LockedOdds from './LockedOdds';
import { assessOddsRisk } from '../utils/riskManagement';

const PopularMatches = ({ matches }) => {
  const dispatch = useDispatch();
  const scrollRef = useRef(null);
  const [displayedMatches, setDisplayedMatches] = useState([]);

  // Smooth transition when matches update
  useEffect(() => {
    if (matches && matches.length > 0) {
      setDisplayedMatches(matches);
    } else {
      setDisplayedMatches([]);
    }
  }, [matches]);

  const addToBetslip = (match, betType, odds) => {
    // Prevent adding bets for matches that have already started
    const hasStart = !!match?.startTime;
    const startDate = hasStart ? new Date(match.startTime) : null;
    if (hasStart && startDate <= new Date()) {
      console.warn('Cannot add started match to betslip:', match?.homeTeam, 'vs', match?.awayTeam);
      return;
    }

    const bet = {
      matchId: match.id || match._id,
      match: `${match.homeTeam} vs ${match.awayTeam}`,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      league: match.league,
      startTime: match.startTime,
      type: betType,
      odds: odds,
      stake: 0,
      sport: match.sport
    };
    dispatch({ type: 'activeBets/addBet', payload: bet });
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -220, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 220, behavior: 'smooth' });
    }
  };

  // Do not render skeletons; rely on cache for instant display

  // Show empty state if no matches
  if (!displayedMatches || displayedMatches.length === 0) {
    return (
      <div className="popular-matches-section">
        <div className="popular-matches-box">
          <div className="popular-matches-header">
            <h2 className="popular-matches-title">Popular Matches</h2>
          </div>
          <div className="popular-matches-empty">
            <p>No popular matches available at the moment.</p>
            <p>Check back later for trending matches!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="popular-matches-section">
      <div className="popular-matches-box">
        <div className="popular-matches-header">
          <h2 className="popular-matches-title">Popular Matches</h2>
        </div>
        <button className="slider-btn prev-btn popular-slider-btn" onClick={scrollLeft} title="Scroll left">&#8249;</button>
        <button className="slider-btn next-btn popular-slider-btn" onClick={scrollRight} title="Scroll right">&#8250;</button>
        <div className="popular-matches-scroll" ref={scrollRef}>
          {displayedMatches.map((match) => (
            <div key={match.id || match._id} className="popular-match-card">
              <div className="match-league">{match.league}</div>
              <div className="match-subcategory">{match.subcategory}</div>
              <div className="match-time">{match.time}</div>
              <div className="match-teams-container">
                <span className="team-name">{match.homeTeam}</span>
                <span className="vs">vs</span>
                <span className="team-name">{match.awayTeam}</span>
              </div>
              <div className="match-odds">
                {['1', 'X', '2'].map((betType) => {
                  const odds = match.odds[betType];
                  
                  if (odds === undefined || odds <= 0) {
                    return null;
                  }
                  
                  const riskAssessment = assessOddsRisk(match, odds, betType);
                  
                  // If odds should be disabled, show locked odds component
                  if (riskAssessment.shouldDisable) {
                    return (
                      <LockedOdds
                        key={betType}
                        riskAssessment={riskAssessment}
                        className="odds-button"
                      />
                    );
                  }
                  
                  // Otherwise show normal odds button
                  return (
                    <button
                        key={betType}
                        className="odds-button popular-odds-button"
                        onClick={() => addToBetslip(match, betType, odds)}
                    >
                        <div className="odds-header">{betType}</div>
                        <div className="odds-value">
                            {odds?.toFixed ? odds.toFixed(2) : odds}
                        </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PopularMatches;