import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import LockedOdds from './LockedOdds';
import SkeletonLoader from './SkeletonLoader';
import { assessOddsRisk } from '../utils/riskManagement';
import { 
  computeFullLeagueTitle, 
  getLeagueDetails 
} from '../utils/leagueTitle';
import { addBet } from '../store/slices/activeBetSlice';
import apiService from '../services/api';
import enhancedCache from '../services/enhancedCache';

const PopularMatches = ({ matches }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const [displayedMatches, setDisplayedMatches] = useState([]);
  const hydrated = useRef(false);

  // Smooth transition when matches update
  useEffect(() => {
    if (matches && matches.length > 0) {
      setDisplayedMatches(matches);
    } else {
      setDisplayedMatches([]);
    }
  }, [matches]);

  useEffect(() => {
    if (hydrated.current) return;
    try {
      const cached = enhancedCache.getCachedData('/matches/popular/trending');
      if (cached && Array.isArray(cached.matches) && cached.matches.length > 0) {
        setDisplayedMatches(cached.matches);
        hydrated.current = true;
      }
    } catch (e) { void e; }
  }, []);

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
      marketType: 'winner',
      marketTypeDisplay: 'Winner',
      odds: odds,
      stake: 0,
      sport: match.sport
    };
    dispatch(addBet(bet));
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
            <SkeletonLoader type="popular-matches" count={3} title="Popular Matches" />
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
          {displayedMatches.map((match) => {
            const rawSportKey = String(match.sport_key || match.sport || '').toLowerCase();
            
            // Generate title from sport key strictly as requested
            const { sport, league } = getLeagueDetails(rawSportKey, match.sport_title);
            let fullLeagueTitle = '';
            
            if (sport && league) {
              fullLeagueTitle = `${sport} . ${league}`;
            } else if (league) {
               // Fallback if sport missing but league present (unlikely with getLeagueDetails)
              fullLeagueTitle = league;
            } else {
               // Fallback to original logic if key parsing fails
                const computedFull = computeFullLeagueTitle({
                  sportKeyOrName: rawSportKey,
                  country: match.country || '',
                  leagueName: match.league || match.sport_title || '',
                  fallbackSportTitle: match.sport_title || ''
                });
                fullLeagueTitle = computedFull
                  .replace(/_/g, '.')
                  .split('.')
                  .map(s => s.trim())
                  .filter(Boolean)
                  .map(s => s.charAt(0).toUpperCase() + s.slice(1))
                  .join('.');
            }

            return (
              <div key={match.id || match._id} className="popular-match-card">
                <div className="match-league">{fullLeagueTitle}</div>
                {/* Date + Time display placed directly under league title */}
                <div className="match-time">
                  {(() => {
                  const dt = match.startTime ? new Date(match.startTime) : null;
                  const dateStr = dt ? dt.toLocaleDateString() : '';
                  const timeStr = dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (match.time || '');
                  return (
                    <span>{dateStr} {timeStr}</span>
                  );
                })()}
              </div>
              <div className="match-teams-container">
                <span
                  className="team-name"
                  role="button"
                  tabIndex={0}
                  title="View additional markets"
                  onClick={() => navigate(`/match/${match.id || match._id}/markets`)}
                  onMouseEnter={() => { try { apiService.getMatchMarkets(match.id || match._id); } catch (e) { void e; } }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/match/${match.id || match._id}/markets`); }}
                >
                  {match.homeTeam}
                </span>
                <span className="vs">vs</span>
                <span
                  className="team-name"
                  role="button"
                  tabIndex={0}
                  title="View additional markets"
                  onClick={() => navigate(`/match/${match.id || match._id}/markets`)}
                  onMouseEnter={() => { try { apiService.getMatchMarkets(match.id || match._id); } catch (e) { void e; } }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/match/${match.id || match._id}/markets`); }}
                >
                  {match.awayTeam}
                </span>
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
            </div>);
          })}
        </div>
      </div>
    </div>
  );
};

export default PopularMatches;
