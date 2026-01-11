import React, { useState, useEffect, useRef } from 'react';
import SkeletonLoader from '../components/SkeletonLoader';
import apiService from '../services/api';
import websocketService from '../services/websocketService';
import enhancedCache from '../services/enhancedCache';
import getMarketTitle, { normalizeMarketKey } from '../utils/marketTitles';

const Bets = () => {
  const [betHistory, setBetHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedBets] = useState(new Set());
  const [stats, setStats] = useState({
    activeBets: 0,
    totalBets: 0,
    winRate: 0,
    wonBets: 0,
    lostBets: 0,
    voidBets: 0,
    cancelledBets: 0
  });
  const [filters, setFilters] = useState({
    status: 'all', // all, pending, won, lost, void
    type: 'all'    // all, single, parlay
  });
  const [selectedBet, setSelectedBet] = useState(null);
  const [showFullPageBet, setShowFullPageBet] = useState(false);
  const subscribedMatchIdsRef = useRef(new Set());
  const resolvedMatchIdsRef = useRef(new Set());

  useEffect(() => {
    let hasInstantData = false;

    // 1) Try sessionStorage for instant display
    try {
      const sessionBets = sessionStorage.getItem('bets_history_data');
      const sessionStats = sessionStorage.getItem('bets_stats_data');
      if (sessionBets || sessionStats) {
        const parsedBets = sessionBets ? JSON.parse(sessionBets) : null;
        const parsedStats = sessionStats ? JSON.parse(sessionStats) : null;
        if (parsedBets && Array.isArray(parsedBets)) {
          setBetHistory(parsedBets);
        }
        if (parsedStats && typeof parsedStats === 'object') {
          setStats(prev => ({ ...prev, ...parsedStats }));
        }
        setLoading(false);
        hasInstantData = true;
      }
    } catch (e) {
      // ignore session errors
    }

    // 2) Fallback to enhanced cache (ETag-backed) if no session data
    if (!hasInstantData) {
      const betsEntry = enhancedCache.getEntry('/bets/my-bets');
      const statsEntry = enhancedCache.getEntry('/bets/stats/summary');
      if ((betsEntry && betsEntry.data) || (statsEntry && statsEntry.data)) {
        if (betsEntry && betsEntry.data) {
          const bets = betsEntry.data.bets || betsEntry.data || [];
          setBetHistory(Array.isArray(bets) ? bets : []);
        }
        if (statsEntry && statsEntry.data) {
          const summary = statsEntry.data;
          const statsFromCache = {
            activeBets: summary.activeBets ?? summary.pendingBets ?? 0,
            totalBets: summary.totalBets ?? 0,
            winRate: summary.winRate != null ? parseFloat(summary.winRate) : 0,
            wonBets: summary.wonBets ?? 0,
            lostBets: summary.lostBets ?? 0,
            voidBets: summary.voidBets ?? 0,
            cancelledBets: summary.cancelledBets ?? 0,
            totalStaked: summary.totalStaked ?? 0,
            totalWon: summary.totalWon ?? 0,
            profit: summary.profit ?? 0
          };
          setStats(prev => ({ ...prev, ...statsFromCache }));
        }
        setLoading(false);
        hasInstantData = true;
      }
    }

    // 3) Fetch in background if we had instant data; otherwise show loading during fetch
    const fetchAll = async () => {
      if (hasInstantData) {
        await fetchBetHistory(false);
        await fetchBetStats();
      } else {
        await fetchBetHistory(true);
        await fetchBetStats();
      }
    };
    fetchAll();

    // 4) Poll lightly to keep cache warm without relying solely on WS
    const intervalId = setInterval(() => {
      fetchBetHistory(false);
      fetchBetStats();
    }, 180000); // every 3 minutes

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (betHistory.length > 0) {
      fetchBetStats();
      // Also update local stats for immediate accuracy
      const localStats = calculateLocalStats(betHistory);
      setStats(prevStats => ({
        ...prevStats,
        ...localStats
      }));
    }
  }, [betHistory]);

  // Resolve missing team names for custom/legacy bets using matchId
  useEffect(() => {
    const missing = betHistory.filter(b => {
      const hasTeams = !!(b.homeTeam && b.awayTeam);
      const hasStringMatch = typeof b.match === 'string' && b.match.includes(' vs ');
      return !hasTeams && !hasStringMatch && b.matchId && !resolvedMatchIdsRef.current.has(String(b.matchId));
    });
    if (missing.length === 0) return;
    const uniqueIds = Array.from(new Set(missing.map(b => String(b.matchId))));
    const run = async () => {
      const updates = [];
      for (const id of uniqueIds) {
        try {
          // Prefer public markets endpoint (works for external event IDs)
          let md = null;
          try {
            const mktResp = await apiService.getMatchMarkets(id, { full: true });
            const mktData = mktResp?.data?.match || mktResp?.data || {};
            md = mktData;
          } catch (e1) { void e1; }
          if (!md) {
            const resp = await apiService.getMatchById(id);
            md = resp?.data?.match || resp?.data || {};
          }
          const home = md?.homeTeam || md?.home_team;
          const away = md?.awayTeam || md?.away_team;
          if (home && away) {
            updates.push({ id, home, away, league: md?.league || md?.sport_title || md?.sport });
            resolvedMatchIdsRef.current.add(String(id));
          }
        } catch (e) { void e; }
      }
      if (updates.length > 0) {
        setBetHistory(prev => prev.map(b => {
          const upd = updates.find(u => String(u.id) === String(b.matchId));
          if (!upd) return b;
          return {
            ...b,
            homeTeam: b.homeTeam || upd.home,
            awayTeam: b.awayTeam || upd.away,
            league: b.league || upd.league
          };
        }));
      }
    };
    run();
  }, [betHistory]);

  // Connect to authenticated WebSocket and stream live FT score updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      websocketService.connect(token);
      websocketService.startHeartbeat();
    }

    const onMatchUpdate = (payload) => {
      const { matchId, result } = payload || {};
      if (!matchId) return;

      // Update betHistory matches with incoming FT scores
      setBetHistory(prev => prev.map(bet => {
        const updatedMatches = (bet.matches || []).map(m => {
          const idStr = m.matchId ? String(m.matchId) : null;
          if (idStr && idStr === String(matchId)) {
            const updated = {
              ...m,
              result: {
                ...(m.result || {}),
                homeScore: result?.homeScore,
                awayScore: result?.awayScore
              }
            };
            if (result && (result.status === 'finished' || result.isFinal === true)) {
              updated.matchStatus = 'Finished';
              updated.result.isFinal = true;
            }
            const derivedOutcome = deriveOutcome(updated);
            const derivedStatus = deriveStatus(updated);
            return { ...updated, derivedOutcome, derivedStatus };
          }
          return m;
        });
        return { ...bet, matches: updatedMatches };
      }));

      // Also update selectedBet if full-page view is open
      setSelectedBet(prev => {
        if (!prev) return prev;
        const updatedMatches = (prev.matches || []).map(m => {
          const idStr = m.matchId ? String(m.matchId) : null;
          if (idStr && idStr === String(matchId)) {
            const updated = {
              ...m,
              result: {
                ...(m.result || {}),
                homeScore: result?.homeScore,
                awayScore: result?.awayScore
              }
            };
            if (result && (result.status === 'finished' || result.isFinal === true)) {
              updated.matchStatus = 'Finished';
              updated.result.isFinal = true;
            }
            const derivedOutcome = deriveOutcome(updated);
            const derivedStatus = deriveStatus(updated);
            return { ...updated, derivedOutcome, derivedStatus };
          }
          return m;
        });
        return { ...prev, matches: updatedMatches };
      });
    };

    websocketService.on('matchResultUpdate', onMatchUpdate);
    const onBetStatusUpdate = (payload) => {
      const isFinal = !!(payload && ((payload.result && payload.result.isFinal === true) || ((payload.status || '').toLowerCase() !== 'pending')));
      if (!isFinal) {
        return;
      }
      if (payload && payload.betId) {
        // Optimistically update the specific bet in the list
        setBetHistory(prev => prev.map(bet => {
          if (bet.id === payload.betId || bet._id === payload.betId) {
            const updatedBet = {
              ...bet,
              status: payload.status,
              settledAt: payload.timestamp
            };
            
            // Apply result if available
            if (payload.result) {
               updatedBet.result = payload.result;
               
               // Also update single match result inside the bet if applicable
               if (updatedBet.matches && updatedBet.matches.length > 0) {
                 updatedBet.matches = updatedBet.matches.map(m => {
                   // Ideally match the matchId, but for single bets usually 1 match
                   return {
                     ...m,
                     result: {
                       ...(m.result || {}),
                       homeScore: payload.result.homeScore,
                       awayScore: payload.result.awayScore,
                       finalOutcome: payload.result.finalOutcome,
                       isFinal: true
                     },
                     outcome: payload.result.finalOutcome,
                     status: payload.status // Propagate status to match
                   };
                 });
               }
            }
            
            // Recalculate derived outcome/status for UI
            if (updatedBet.matches && updatedBet.matches.length > 0) {
               updatedBet.matches = updatedBet.matches.map(m => ({
                 ...m,
                 derivedOutcome: deriveOutcome(m),
                 derivedStatus: deriveStatus(m)
               }));
            }
            
            return updatedBet;
          }
          return bet;
        }));
      }
      
      fetchBetHistory(false);
      fetchBetStats();
    };
    websocketService.on('betStatusUpdate', onBetStatusUpdate);

    try {
      websocketService.subscribeToUserBets(undefined);
    } catch (e) {
      console.warn('subscribeToUserBets failed', e && e.message ? e.message : e);
    }

    return () => {
      websocketService.off('matchResultUpdate', onMatchUpdate);
      websocketService.off('betStatusUpdate', onBetStatusUpdate);
      websocketService.stopHeartbeat();
      websocketService.disconnect();
    };
  }, []);

  // Subscribe to match streams for expanded bets and full-page bet view
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Ensure connection is active
    const status = websocketService.getConnectionStatus?.();
    if (!status || !status.isConnected) {
      websocketService.connect(token);
    }

    const nextSubscribed = new Set();

    // Subscribe to matches in any expanded bet cards
    filteredBets.forEach(bet => {
      if (expandedBets.has(bet.id)) {
        (bet.matches || []).forEach(m => {
          if (m.matchId) nextSubscribed.add(String(m.matchId));
        });
      }
    });

    // Subscribe to matches visible in full-page bet view
    if (showFullPageBet && selectedBet) {
      (selectedBet.matches || []).forEach(m => {
        if (m.matchId) nextSubscribed.add(String(m.matchId));
      });
    }

    // Subscribe new IDs and unsubscribe removed ones
    const prevSubscribed = subscribedMatchIdsRef.current;
    nextSubscribed.forEach(id => {
      if (!prevSubscribed.has(id)) {
        websocketService.subscribeToMatch(id);
      }
    });
    prevSubscribed.forEach(id => {
      if (!nextSubscribed.has(id)) {
        websocketService.unsubscribeFromMatch(id);
      }
    });

    subscribedMatchIdsRef.current = nextSubscribed;
  }, [expandedBets, selectedBet, showFullPageBet, betHistory, filters]);

  // Listen for real-time bet updates and refresh lists
  useEffect(() => {
    const onBetUpdate = () => {
      fetchBetHistory();
      fetchBetStats();
    };
    window.addEventListener('bet:update', onBetUpdate);
    return () => window.removeEventListener('bet:update', onBetUpdate);
  }, []);



  const fetchBetHistory = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      console.log('Fetching bet history...');
      const response = await apiService.getUserBets({
        page: 1,
        limit: 100, // Fetch more to allow client-side filtering
        excludeMarket: 'Aviator' // Exclude Aviator bets from normal history
      });
      console.log('Bet history API response:', response);
      
      if (response && response.data) {
        console.log('Bet history data:', response.data);
        const bets = response.data.bets || [];
        setBetHistory(bets);
        try {
          sessionStorage.setItem('bets_history_data', JSON.stringify(bets));
        } catch (e) { /* ignore */ }
      } else {
        console.log('No response data received');
        setBetHistory([]);
      }
    } catch (err) {
      console.error('Failed to fetch bet history:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError('Failed to load bet history.');
      setBetHistory([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Calculate local statistics from bet data
  const calculateLocalStats = (bets) => {
    const totalBets = bets.length;
    const activeBets = bets.filter(bet => (bet.status || 'pending').toLowerCase() === 'pending').length;
    const wonBets = bets.filter(bet => (bet.status || '').toLowerCase() === 'won').length;
    const lostBets = bets.filter(bet => (bet.status || '').toLowerCase() === 'lost').length;
    const voidBets = bets.filter(bet => (bet.status || '').toLowerCase() === 'void').length;
    const cancelledBets = bets.filter(bet => (bet.status || '').toLowerCase() === 'cancelled').length;
    
    const settledBets = wonBets + lostBets;
    const winRate = settledBets > 0 ? ((wonBets / settledBets) * 100).toFixed(1) : 0;
    
    return {
      totalBets,
      activeBets,
      wonBets,
      lostBets,
      voidBets,
      cancelledBets,
      winRate: parseFloat(winRate)
    };
  };

  const fetchBetStats = async () => {
    try {
      console.log('Fetching bet stats summary from database...');
      // Filter out Aviator bets from normal bets stats
      const response = await apiService.getBetStatsSummary({ excludeMarket: 'Aviator' });
      console.log('Bet stats API response:', response);
      
      if (response && response.data) {
        const summary = response.data;
        console.log('Processing bet stats summary:', summary);
        
        // Use backend data directly (it's more accurate than local calculation)
        const statsFromDB = {
          activeBets: summary.activeBets ?? summary.pendingBets ?? 0,
          totalBets: summary.totalBets ?? 0,
          winRate: summary.winRate != null ? parseFloat(summary.winRate) : 0,
          wonBets: summary.wonBets ?? 0,
          lostBets: summary.lostBets ?? 0,
          voidBets: summary.voidBets ?? 0,
          cancelledBets: summary.cancelledBets ?? 0,
          totalStaked: summary.totalStaked ?? 0,
          totalWon: summary.totalWon ?? 0,
          profit: summary.profit ?? 0
        };
        
        console.log('Setting stats from database:', statsFromDB);
        setStats(statsFromDB);
        try {
          sessionStorage.setItem('bets_stats_data', JSON.stringify(statsFromDB));
        } catch (e) { /* ignore */ }
      } else {
        console.warn('No data received from bet stats API, using local calculation');
        // Fallback to local calculation if API fails
        const localStats = calculateLocalStats(betHistory);
        setStats(localStats);
      }
    } catch (err) {
      console.error('Failed to fetch bet stats summary:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      // Fallback to local calculation if API fails
      console.log('Using local calculation as fallback');
      const localStats = calculateLocalStats(betHistory);
      setStats(localStats);
    }
  };

  // Preserve data on navigation hide to enable instant restoration
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        try {
          if (betHistory.length > 0) {
            sessionStorage.setItem('bets_history_data', JSON.stringify(betHistory));
          }
          if (stats && typeof stats === 'object') {
            sessionStorage.setItem('bets_stats_data', JSON.stringify(stats));
          }
        } catch (e) { /* ignore */ }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [betHistory, stats]);

  // Removed legacy status helpers (color/icon) since redesigned UI no longer uses them

  // Parse a pick to identify standardized market type and point
  const parsePick = (selection, point, matchCtx = null) => {
    const raw = selection ? String(selection).trim() : '';
    const low = raw.toLowerCase();
    let kind = null; // 'totals' | 'winner' | 'handicap' | 'btts'
    let type = null; // 'over' | 'under' | '1' | 'x' | '2' | 'yes' | 'no'
    let side = null; // 'home' | 'away' | 'draw'
    let refPoint = null;
    let bandMin = null;
    let bandMax = null;
    let player = null;
    let scoreHome = null;
    let scoreAway = null;

    const parenMatch = raw.match(/\(([-+]?\d+(?:\.\d+)?)\)/);
    const numberMatch = raw.match(/(-?\d+(?:\.\d+)?)/);
    if (point != null && !Number.isNaN(Number(point))) {
      refPoint = Number(point);
    } else if (parenMatch) {
      refPoint = Number(parenMatch[1]);
    } else if (numberMatch && /over|under|ov|und|o\b|u\b/i.test(raw)) {
      refPoint = Number(numberMatch[1]);
    }

    // BTTS (Both Teams To Score)
    if (/btts|both\s*teams\s*to\s*score|gg|ng/i.test(low)) {
      kind = 'btts';
      if (/yes|gg/i.test(low)) type = 'yes';
      else if (/no|ng/i.test(low)) type = 'no';
    }

    // Totals (Over/Under) with flexible labels
    if (/\b(over|ov|o)\b/i.test(low)) { kind = 'totals'; type = 'over'; }
    if (/\b(under|und|u)\b/i.test(low)) { kind = 'totals'; type = 'under'; }

    // Winner (1X2) or named moneyline
    if (['1', 'x', '2'].includes(low)) { kind = 'winner'; type = low; }
    if (/^home\b|home\s*win/i.test(low)) { kind = 'winner'; type = '1'; side = 'home'; }
    if (/^away\b|away\s*win/i.test(low)) { kind = 'winner'; type = '2'; side = 'away'; }
    if (/^draw\b|tie\b/i.test(low)) { kind = 'winner'; type = 'x'; side = 'draw'; }
    if (!kind && matchCtx) {
      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const selNorm = norm(raw);
      const homeNorm = norm(matchCtx.homeTeam || matchCtx.home_team || '');
      const awayNorm = norm(matchCtx.awayTeam || matchCtx.away_team || '');
      const contains = (a, b) => a.includes(b) || b.includes(a);
      if (homeNorm && contains(selNorm, homeNorm)) { kind = 'winner'; type = '1'; side = 'home'; }
      else if (awayNorm && contains(selNorm, awayNorm)) { kind = 'winner'; type = '2'; side = 'away'; }
    }

    // Handicap/Spread: detect side and signed point
    if (/handicap|spread|\b\d\s*\(|home\s*\(|away\s*\(/i.test(low)) {
      const sideHome = /(^|\b)(1|home)\b/i.test(low);
      const sideAway = /(^|\b)(2|away)\b/i.test(low);
      if (sideHome || sideAway) {
        kind = 'handicap';
        side = sideHome ? 'home' : 'away';
        if (refPoint == null && numberMatch) refPoint = Number(numberMatch[1]);
      }
    }

    if (/\bcorners?\b/i.test(low)) {
      if (/\b(over|ov|o)\b/i.test(low)) { kind = 'corners_totals'; type = 'over'; }
      if (/\b(under|und|u)\b/i.test(low)) { kind = 'corners_totals'; type = 'under'; }
    }

    if (/\bcards?\b/i.test(low)) {
      if (/\b(over|ov|o)\b/i.test(low)) { kind = 'cards_totals'; type = 'over'; }
      if (/\b(under|und|u)\b/i.test(low)) { kind = 'cards_totals'; type = 'under'; }
    }

    if (/\bodd\b/i.test(low) || /\beven\b/i.test(low)) {
      if (/\bodd\b/i.test(low)) { kind = 'odd_even'; type = 'odd'; }
      if (/\beven\b/i.test(low)) { kind = 'odd_even'; type = 'even'; }
    }

    // Correct Score vs Multi Goals disambiguation:
    // - If pattern "A-B" without "goals" keyword -> Correct Score
    // - If "A-B goals" or "A+" -> Multi Goals
    const scoreMatch = raw.match(/^\s*(\d+)\s*-\s*(\d+)\s*(?!goals)\s*$/i);
    const bandMatch = raw.match(/\b(\d+)\s*-\s*(\d+)\s*goals?\b/i);
    const plusMatch = raw.match(/\b(\d+)\s*\+\b/);
    if (scoreMatch) {
      kind = 'correct_score';
      scoreHome = Number(scoreMatch[1]);
      scoreAway = Number(scoreMatch[2]);
    } else if (bandMatch) {
      kind = 'multi_goals';
      bandMin = Number(bandMatch[1]);
      bandMax = Number(bandMatch[2]);
    } else if (plusMatch) {
      kind = 'multi_goals';
      bandMin = Number(plusMatch[1]);
      bandMax = null;
    }

    if (/\bgoalscorer\b/i.test(low)) {
      kind = 'goalscorer';
      if (/first/i.test(low)) type = 'first';
      else if (/anytime/i.test(low)) type = 'anytime';
      else if (/last/i.test(low)) type = 'last';
      const nameMatch = raw.match(/:\s*([A-Za-z\s.'-]+)/) || raw.match(/\bby\s+([A-Za-z\s.'-]+)\b/);
      if (nameMatch) player = nameMatch[1].trim();
    }

    return { kind, type, side, point: refPoint, bandMin, bandMax, player, raw, scoreHome, scoreAway };
  };

  // Derive outcome text from match result, aligned to the pick context
  const deriveOutcome = (match) => {
    const ms = String(match?.matchStatus || match?.status || '').toLowerCase();
    const isCompleted = ms === 'finished' || ms === 'completed' || ms === 'ended' || match?.result?.isFinal === true;
    if (!isCompleted) return null;
    const hs = match?.result?.homeScore;
    const as = match?.result?.awayScore;
    const hasScores = typeof hs === 'number' && typeof as === 'number';

    const pick = parsePick(match?.selection, match?.point, match);
    const marketNorm = normalizeMarketKey(match?.market || (selectedBet ? selectedBet.market : '') || '');

    if (!hasScores) return null;

    // Totals (Over/Under)
    if (pick.kind === 'totals' && (pick.type === 'over' || pick.type === 'under')) {
      const total = hs + as;
      const p = pick.point != null ? pick.point : null;
      if (p == null) {
        // If no point is available, infer closest half-point around total
        const inferred = Math.floor(total) + 0.5;
        return total > inferred ? `Over(${inferred})` : `Under(${inferred})`;
      }
      return total > p ? `Over(${p})` : `Under(${p})`;
    }

    // Winner (1/X/2)
    if (pick.kind === 'winner' && (pick.type === '1' || pick.type === 'x' || pick.type === '2')) {
      if (hs > as) return match.homeTeam || 'Home';
      if (hs < as) return match.awayTeam || 'Away';
      return 'Draw';
    }

    // Handicap: adjusted scores
    if (pick.kind === 'handicap' && pick.point != null && (pick.side === 'home' || pick.side === 'away')) {
      const adjHome = hs + (pick.side === 'home' ? pick.point : 0);
      const adjAway = as + (pick.side === 'away' ? pick.point : 0);
      const labelPoint = pick.point >= 0 ? `+${pick.point}` : `${pick.point}`;
      if (adjHome > adjAway) return `Home(${labelPoint})`;
      if (adjHome < adjAway) return `Away(${labelPoint})`;
      return `Draw(${labelPoint})`;
    }

    // BTTS
    if (pick.kind === 'btts' || marketNorm === 'both_teams_to_score') {
      const bothScored = hs > 0 && as > 0;
      return bothScored ? 'Yes' : 'No';
    }

    if (pick.kind === 'corners_totals') {
      const homeCorners = Number(match?.result?.homeCorners ?? 0);
      const awayCorners = Number(match?.result?.awayCorners ?? 0);
      const total = homeCorners + awayCorners;
      const p = pick.point != null ? pick.point : null;
      if (p == null) {
        const inferred = Math.floor(total) + 0.5;
        return total > inferred ? `Over(${inferred})` : `Under(${inferred})`;
      }
      return total > p ? `Over(${p})` : `Under(${p})`;
    }

    if (pick.kind === 'cards_totals') {
      const homeCards = Number(match?.result?.homeCards ?? 0);
      const awayCards = Number(match?.result?.awayCards ?? 0);
      const total = homeCards + awayCards;
      const p = pick.point != null ? pick.point : null;
      if (p == null) {
        const inferred = Math.floor(total) + 0.5;
        return total > inferred ? `Over(${inferred})` : `Under(${inferred})`;
      }
      return total > p ? `Over(${p})` : `Under(${p})`;
    }

    if (pick.kind === 'odd_even') {
      const total = hs + as;
      return total % 2 === 0 ? 'Even' : 'Odd';
    }

    if (pick.kind === 'correct_score') {
      return `${hs}-${as}`;
    }

    if (pick.kind === 'multi_goals') {
      const total = hs + as;
      if (pick.bandMin != null && pick.bandMax != null) {
        if (total >= pick.bandMin && total <= pick.bandMax) return `${pick.bandMin}-${pick.bandMax}`;
        return String(total);
      }
      if (pick.bandMin != null && pick.bandMax == null) {
        if (total >= pick.bandMin) return `${pick.bandMin}+`;
        return String(total);
      }
    }

    if (pick.kind === 'goalscorer') {
      const first = match?.result?.firstGoalscorer;
      const last = match?.result?.lastGoalscorer;
      const anytime = match?.result?.anytimeGoalscorers;
      if (pick.type === 'first') return first || null;
      if (pick.type === 'last') return last || null;
      if (pick.type === 'anytime') return anytime || null;
    }

    // Fallback: general outcome from scores
    if (hs > as) return match.homeTeam || 'Home';
    if (hs < as) return match.awayTeam || 'Away';
    return 'Draw';
  };

  // Derive status from pick vs derived outcome
  const deriveStatus = (match) => {
    const ms = String(match?.matchStatus || match?.status || '').toLowerCase();
    const isCompleted = ms === 'finished' || ms === 'completed' || ms === 'ended' || match?.result?.isFinal === true;
    if (!isCompleted) return 'pending';
    const hs = match?.result?.homeScore;
    const as = match?.result?.awayScore;
    const hasScores = typeof hs === 'number' && typeof as === 'number';
    if (!hasScores) {
      const st = String(match?.status || '').toLowerCase();
      if (st === 'win') return 'won';
      if (st === 'loss') return 'lost';
      return 'pending';
    }

    const pick = parsePick(match?.selection, match?.point, match);
    const outcomeText = deriveOutcome(match);
    const lowOutcome = (outcomeText || '').toLowerCase().replace(/\s+/g, '');
    const marketNorm = normalizeMarketKey(match?.market || (selectedBet ? selectedBet.market : '') || '');

    // Compare against pick
    if (pick.kind === 'totals' && (pick.type === 'over' || pick.type === 'under')) {
      const p = pick.point != null ? pick.point : null;
      const target = p != null ? `${pick.type}(${p})` : pick.type;
      const lowTarget = target.toLowerCase().replace(/\s+/g, '');
      return lowOutcome === lowTarget ? 'won' : 'lost';
    }
    if (pick.kind === 'winner' && pick.type === '1') {
      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const homeNorm = norm(match.homeTeam || match.home_team || '');
      const outcomeNorm = norm(outcomeText);
      const isHomeOutcome = outcomeNorm === 'home win' || outcomeNorm === homeNorm || outcomeNorm === 'home';
      return isHomeOutcome ? 'won' : 'lost';
    }
    if (pick.kind === 'winner' && pick.type === '2') {
      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const awayNorm = norm(match.awayTeam || match.away_team || '');
      const outcomeNorm = norm(outcomeText);
      const isAwayOutcome = outcomeNorm === 'away win' || outcomeNorm === awayNorm || outcomeNorm === 'away';
      return isAwayOutcome ? 'won' : 'lost';
    }
    if (pick.kind === 'winner' && pick.type === 'x') {
      const outcomeNorm = (outcomeText || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const isDrawOutcome = outcomeNorm === 'draw' || outcomeNorm === 'x';
      return isDrawOutcome ? 'won' : 'lost';
    }

    if (pick.kind === 'handicap' && pick.point != null && (pick.side === 'home' || pick.side === 'away')) {
      const labelPoint = pick.point >= 0 ? `+${pick.point}` : `${pick.point}`;
      const target = `${pick.side === 'home' ? 'home' : 'away'}(${labelPoint})`;
      const lowTarget = target.toLowerCase().replace(/\s+/g, '');
      return lowOutcome === lowTarget ? 'won' : 'lost';
    }

    if (pick.kind === 'btts' || marketNorm === 'both_teams_to_score') {
      const sel = (match?.selection || '').toLowerCase();
      let inferredType = pick.type;
      if (!inferredType) {
        if (/\bng\b|\bno\b/.test(sel)) inferredType = 'no';
        else if (/\bgg\b|\byes\b/.test(sel)) inferredType = 'yes';
        else inferredType = 'yes';
      }
      const lowTarget = inferredType.toLowerCase();
      return lowOutcome === lowTarget ? 'won' : 'lost';
    }

    if (pick.kind === 'corners_totals' && (pick.type === 'over' || pick.type === 'under')) {
      const p = pick.point != null ? pick.point : null;
      const target = p != null ? `${pick.type}(${p})` : pick.type;
      const lowTarget = target.toLowerCase().replace(/\s+/g, '');
      return lowOutcome === lowTarget ? 'won' : 'lost';
    }

    if (pick.kind === 'cards_totals' && (pick.type === 'over' || pick.type === 'under')) {
      const p = pick.point != null ? pick.point : null;
      const target = p != null ? `${pick.type}(${p})` : pick.type;
      const lowTarget = target.toLowerCase().replace(/\s+/g, '');
      return lowOutcome === lowTarget ? 'won' : 'lost';
    }

    if (pick.kind === 'odd_even' && (pick.type === 'odd' || pick.type === 'even')) {
      const lowTarget = pick.type.toLowerCase();
      return lowOutcome === lowTarget ? 'won' : 'lost';
    }

    if (pick.kind === 'correct_score') {
      const target = `${pick.scoreHome}-${pick.scoreAway}`;
      return lowOutcome === target.toLowerCase() ? 'won' : 'lost';
    }

    if (pick.kind === 'multi_goals') {
      if (pick.bandMin != null && pick.bandMax != null) {
        const target = `${pick.bandMin}-${pick.bandMax}`;
        return lowOutcome === target.toLowerCase() ? 'won' : 'lost';
      }
      if (pick.bandMin != null && pick.bandMax == null) {
        const target = `${pick.bandMin}+`;
        return lowOutcome === target.toLowerCase() ? 'won' : 'lost';
      }
    }

    if (pick.kind === 'goalscorer') {
      if (pick.type === 'first' && pick.player) return lowOutcome.includes(pick.player.toLowerCase()) ? 'won' : 'lost';
      if (pick.type === 'last' && pick.player) return lowOutcome.includes(pick.player.toLowerCase()) ? 'won' : 'lost';
      if (pick.type === 'anytime' && pick.player) return lowOutcome.includes(pick.player.toLowerCase()) ? 'won' : 'lost';
      if (pick.type && !pick.player) {
        return outcomeText ? 'won' : 'lost';
      }
    }

    // Unknown pick type: conservatively compare generic outcome to selection text
    const lowPick = (pick.raw || '').toLowerCase().replace(/\s+/g, '');
    return lowOutcome && lowPick && lowOutcome.includes(lowPick) ? 'won' : 'lost';
  };

  

  // Full-page bet view functions
  const openFullPageBet = async (bet) => {
    let enriched = { ...bet };
    const hasTeams = !!(enriched.homeTeam && enriched.awayTeam);
    const hasStringMatch = typeof enriched.match === 'string' && enriched.match.includes(' vs ');
    if (!hasTeams && !hasStringMatch && enriched.matchId) {
      try {
        // Prefer public markets endpoint for external IDs
        let md = null;
        try {
          const mktResp = await apiService.getMatchMarkets(enriched.matchId, { full: true });
          md = mktResp?.data?.match || mktResp?.data || null;
        } catch (e1) { void e1; }
        if (!md) {
          const resp = await apiService.getMatchById(enriched.matchId);
          md = resp?.data?.match || resp?.data || {};
        }
        const home = md?.homeTeam || md?.home_team;
        const away = md?.awayTeam || md?.away_team;
        const league = md?.league || md?.sport_title || md?.sport;
        if (home && away) {
          enriched.homeTeam = home;
          enriched.awayTeam = away;
        }
        if (league && !enriched.league) {
          enriched.league = league;
        }
      } catch (e) { void e; }
    }
    setSelectedBet(enriched);
    setShowFullPageBet(true);
  };

  const closeFullPageBet = () => {
    setSelectedBet(null);
    setShowFullPageBet(false);
  };

  const formatOdds = (odds) => {
    if (typeof odds === 'number') {
      return odds.toFixed(2);
    } else if (odds && typeof odds.selected === 'number') {
      return odds.selected.toFixed(2);
    } else if (odds && typeof odds === 'string') {
      return parseFloat(odds).toFixed(2);
    }
    return '0.00';
  };

  const formatAmount = (amount) => {
    if (typeof amount === 'number') {
      return amount.toFixed(2);
    } else if (amount && typeof amount === 'string') {
      return parseFloat(amount).toFixed(2);
    }
    return '0.00';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter functions
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const filteredBets = React.useMemo(() => {
    return betHistory.filter(bet => {
      // Status filter
      if (filters.status !== 'all') {
        const betStatus = (bet.status || 'pending').toLowerCase();
        if (filters.status !== betStatus) {
          return false;
        }
      }

      // Type filter
      if (filters.type !== 'all') {
        const isParlay = bet.market === 'parlay' && bet.matches && bet.matches.length > 1;
        if (filters.type === 'parlay' && !isParlay) {
          return false;
        }
        if (filters.type === 'single' && isParlay) {
          return false;
        }
      }

      return true;
    });
  }, [betHistory, filters]);

  // Function to expand multibets into individual match rows

  return (
    <div className="bets-page">
      <div className="bets-header">
        <h1>My Bets</h1>
        <div className="bets-stats">
          <div className="stat-card">
            <span className="stat-label">Active Bets</span>
            <span className="stat-value">{stats.activeBets}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Bets</span>
            <span className="stat-value">{stats.totalBets}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Win Rate</span>
            <span className="stat-value">{stats.winRate}%</span>
          </div>
        </div>
      </div>

      <div className="bets-content">
        {(loading && betHistory.length === 0) ? (
          <div style={{ padding: '12px 0' }}>
            <SkeletonLoader type="generic" count={5} />
          </div>
        ) : error ? (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button onClick={fetchBetHistory} className="retry-btn">
              Retry
            </button>
          </div>
        ) : betHistory.length === 0 ? (
        <div className="no-bets">
          <div className="no-bets-icon">🎯</div>
          <h3>No bets placed yet</h3>
          <p>Start betting on your favorite sports to see your bet history here.</p>
        </div>
        ) : (
          <div className="bet-history-container">
            <div className="bet-history-header">
              <div className="bet-history-title-section">
                <h2>Bet History</h2>
                <div className="bet-history-stats">
                  <span className="stat-item">Total: {stats.totalBets}</span>
                  <span className="stat-item">Pending: {stats.activeBets}</span>
                  <span className="stat-item">Won: {stats.wonBets}</span>
                  <span className="stat-item">Lost: {stats.lostBets}</span>
                </div>
              </div>
              
              <div className="bet-filters">
                <div className="filter-group">
                  <label>Status:</label>
                  <select 
                    value={filters.status} 
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="void">Void</option>
                  </select>
                </div>
                
                <div className="filter-group">
                  <label>Type:</label>
                  <select 
                    value={filters.type} 
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All</option>
                    <option value="single">Single</option>
                    <option value="parlay">Multibet</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="bet-history-list">
              {filteredBets.map((bet) => {
                const isExpanded = expandedBets.has(bet.id);
                const isMultibet = bet.market === 'parlay' && bet.matches && bet.matches.length > 1;
                
                // For testing - create sample matches if none exist
                let displayMatches = bet.matches || [];
                // Normalize match status casing and shape for consistent rendering
                
                if (isMultibet && displayMatches.length === 0) {
                  // Parse matches from selection string for legacy bets
                  if (bet.selection && bet.selection.includes(';')) {
                    const matchStrings = bet.selection.split(';');
                    displayMatches = matchStrings.map((matchStr, index) => {
                      const parts = matchStr.split(':');
                      if (parts.length >= 2) {
                        const matchName = parts[0].trim();
                        const selectionPart = parts[1].trim();
                        const selectionMatch = selectionPart.match(/(.+?)\s*\(([0-9.]+)\)/);
                        
                        return {
                          matchId: `legacy-${index}`,
                          homeTeam: matchName.split(' vs ')[0] || 'Unknown',
                          awayTeam: matchName.split(' vs ')[1] || 'Unknown',
                          selection: selectionMatch ? selectionMatch[1].trim() : '1',
                          odds: selectionMatch ? parseFloat(selectionMatch[2]) : 1.5,
                          status: index === 0 ? 'won' : index === 1 ? 'won' : 'pending',
                          outcome: index === 0 ? '1' : index === 1 ? '2' : null,
                          startTime: new Date()
                        };
                      }
                      return null;
                    }).filter(Boolean);
                  }
                }
                
                // For single bets, create a single match entry
                if (!isMultibet && displayMatches.length === 0) {
                  const key = bet.market ? normalizeMarketKey(bet.market) : '';
                  const marketTypeDisplay = (() => {
                    if (!key) return 'Market';
                    if (key === 'winner') return 'Winner';
                    if (key.startsWith('totals') || key.startsWith('alternate_totals') || key.startsWith('team_totals') || key.startsWith('alternate_team_totals')) return 'Over/Under';
                    if (key.startsWith('spreads') || key.startsWith('alternate_spreads')) return 'Handicap';
                    if (key === 'outrights') return 'Outrights';
                    return getMarketTitle(key);
                  })();
                  const matchStr = typeof bet.match === 'string' ? bet.match : '';
                  const split = matchStr.includes(' vs ') ? matchStr.split(' vs ') : [];
                  const homeName = bet.homeTeam || (split[0] || 'Unknown');
                  const awayName = bet.awayTeam || (split[1] || 'Unknown');
                  const isFinal = !!(bet.result && (bet.result.isFinal === true || (typeof bet.result?.homeScore === 'number' && typeof bet.result?.awayScore === 'number'))) || (String(bet.status || '').toLowerCase() !== 'pending');
                  displayMatches = [{
                    matchId: bet.matchId,
                    homeTeam: homeName,
                    awayTeam: awayName,
                    market: bet.market,
                    marketTypeDisplay,
                    selection: bet.selection,
                    odds: bet.odds?.selected || bet.odds,
                    status: bet.status,
                    matchStatus: isFinal ? 'finished' : (bet.status || 'pending'),
                    outcome: bet.result?.outcome || bet.status,
                    result: bet.result || null,
                    startTime: bet.createdAt
                  }];
                }
                
                // Compute derived outcome and status per match
                displayMatches = displayMatches.map(m => {
                  const derivedOutcome = deriveOutcome(m);
                  const derivedStatus = deriveStatus(m);
                  const matchStr = typeof bet.match === 'string' && bet.match.includes(' vs ') ? bet.match.split(' vs ') : [];
                  const safeHome = (m.homeTeam && m.homeTeam !== 'Unknown')
                    ? m.homeTeam
                    : (bet.homeTeam || matchStr[0] || m.homeTeam || '');
                  const safeAway = (m.awayTeam && m.awayTeam !== 'Unknown')
                    ? m.awayTeam
                    : (bet.awayTeam || matchStr[1] || m.awayTeam || '');
                  return {
                    ...m,
                    homeTeam: safeHome || m.homeTeam || '',
                    awayTeam: safeAway || m.awayTeam || '',
                    derivedOutcome,
                    derivedStatus
                  };
                });

                

                return (
                  <div key={bet.id} className={`bet-card ${bet.status} ${isExpanded ? 'expanded' : 'collapsed'}`}>
                    {/* Collapsed Summary (hidden when expanded) */}
                    {!isExpanded && (
                      <div 
                        className="bet-summary-collapsed"
                        title={(() => {
                          const m0 = displayMatches[0] || null;
                          const ms = String(m0?.matchStatus || m0?.status || '').toLowerCase();
                          const isCompleted = ms === 'finished' || ms === 'completed' || ms === 'ended' || m0?.result?.isFinal === true;
                          if (!isMultibet && isCompleted && m0?.result && m0.result.homeScore != null && m0.result.awayScore != null) {
                            return `FT: ${m0.result.homeScore}-${m0.result.awayScore}`;
                          }
                          return undefined;
                        })()}
                        onClick={() => openFullPageBet(bet)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="bet-summary-info">
                          <div className="bet-summary-title">#{bet.id?.slice(-6) || 'N/A'} • {formatDate(bet.createdAt)}</div>
                        </div>
                        <div className="bet-summary-amounts">
                          <span className="bet-summary-payout">${formatAmount(bet.potentialWin)}</span>
                          {(() => {
                            const agg = (() => {
                              const statuses = (displayMatches || []).map(m => m.derivedStatus);
                              if (statuses.includes('lost')) return 'lost';
                              if (statuses.includes('pending')) return 'pending';
                              if (statuses.includes('void')) return 'void';
                              if (statuses.length > 0 && statuses.every(s => s === 'won')) return 'won';
                              return (bet.status || 'pending').toLowerCase();
                            })();
                            const label = agg === 'won' ? 'Won' : agg === 'lost' ? 'Lost' : agg === 'void' ? 'Void' : 'Pending';
                            return <span className={`bet-status status-${agg}`}>{label}</span>;
                          })()}
                        </div>
                      </div>
                    )}

                    
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Full-page bet view */}
      {showFullPageBet && selectedBet && (
        <div className="full-page-bet-overlay">
          <div className="full-page-bet-container">
            <div className="full-page-bet-header">
              <h2>Bet Details - #{selectedBet.id?.slice(-6) || 'N/A'}</h2>
              <button 
                className="close-full-page-btn"
                onClick={closeFullPageBet}
                title="Close full page view"
              >
                ✕
              </button>
            </div>
            
            <div className="full-page-bet-content">
              {(() => {
                const bet = selectedBet;
                const isMultibet = bet.market === 'parlay' && bet.matches && bet.matches.length > 1;
                
                // Reuse the same logic for displaying matches
                let displayMatches = bet.matches || [];
                
                if (isMultibet && displayMatches.length === 0) {
                  if (bet.selection && bet.selection.includes(';')) {
                    const matchStrings = bet.selection.split(';');
                    displayMatches = matchStrings.map((matchStr, index) => {
                      const parts = matchStr.split(':');
                      if (parts.length >= 2) {
                        const matchName = parts[0].trim();
                        const selectionPart = parts[1].trim();
                        const selectionMatch = selectionPart.match(/(.+?)\s*\(([0-9.]+)\)/);
                        
                        return {
                          matchId: `legacy-${index}`,
                          homeTeam: matchName.split(' vs ')[0] || 'Unknown',
                          awayTeam: matchName.split(' vs ')[1] || 'Unknown',
                          selection: selectionMatch ? selectionMatch[1].trim() : '1',
                          odds: selectionMatch ? parseFloat(selectionMatch[2]) : 1.5,
                          status: index === 0 ? 'won' : index === 1 ? 'won' : 'pending',
                          outcome: index === 0 ? '1' : index === 1 ? '2' : null,
                          startTime: new Date()
                        };
                      }
                      return null;
                    }).filter(Boolean);
                  }
                }
                
                if (!isMultibet && displayMatches.length === 0) {
                  const key2 = bet.market ? normalizeMarketKey(bet.market) : '';
                  const marketTypeDisplay2 = (() => {
                    if (!key2) return 'Market';
                    if (key2 === 'winner') return 'Winner';
                    if (key2.startsWith('totals') || key2.startsWith('alternate_totals') || key2.startsWith('team_totals') || key2.startsWith('alternate_team_totals')) return 'Over/Under';
                    if (key2.startsWith('spreads') || key2.startsWith('alternate_spreads')) return 'Handicap';
                    if (key2 === 'outrights') return 'Outrights';
                    return getMarketTitle(key2);
                  })();
                  const matchStr2 = typeof bet.match === 'string' ? bet.match : '';
                  const split2 = matchStr2.includes(' vs ') ? matchStr2.split(' vs ') : [];
                  const homeName2 = bet.homeTeam || (split2[0] || 'Unknown');
                  const awayName2 = bet.awayTeam || (split2[1] || 'Unknown');
                  const isFinal2 = !!(bet.result && (bet.result.isFinal === true || (typeof bet.result?.homeScore === 'number' && typeof bet.result?.awayScore === 'number'))) || (String(bet.status || '').toLowerCase() !== 'pending');
                  displayMatches = [{
                    matchId: bet.matchId,
                    homeTeam: homeName2,
                    awayTeam: awayName2,
                    market: bet.market,
                    marketTypeDisplay: marketTypeDisplay2,
                    selection: bet.selection,
                    odds: bet.odds?.selected || bet.odds,
                    status: bet.status,
                    matchStatus: isFinal2 ? 'finished' : (bet.status || 'pending'),
                    outcome: bet.result?.outcome || bet.status,
                    result: bet.result || null,
                    startTime: bet.createdAt
                  }];
                }
                
                displayMatches = displayMatches.map(m => {
                  const derivedOutcome = deriveOutcome(m);
                  const derivedStatus = deriveStatus(m);
                  return {
                    ...m,
                    derivedOutcome,
                    derivedStatus
                  };
                });

                const wonCount = displayMatches.filter(m => (m.derivedStatus) === 'won').length;
                const lostCount = displayMatches.filter(m => (m.derivedStatus) === 'lost').length;
                const totalCount = displayMatches.length || 1;

                const getFtResult = (match) => {
                  const ms = String(match?.matchStatus || match?.status || '').toLowerCase();
                  const isCompleted = ms === 'finished' || ms === 'completed' || ms === 'ended' || match?.result?.isFinal === true;
                  if (!isCompleted) return '—';
                  if (match.result && (match.result.homeScore != null || match.result.awayScore != null)) {
                    const hs = match.result.homeScore ?? '-';
                    const as = match.result.awayScore ?? '-';
                    return `${hs}-${as}`;
                  }
                  if (match.finalScore) return match.finalScore;
                  if (match.outcome && ['1','X','2'].includes(String(match.outcome))) return match.outcome;
                  return '—';
                };

                return (
                  <div className="full-page-bet-details">
                    {/* Bet Summary */}
                    <div className="full-page-bet-summary">
                      <div className="summary-cards">
                        <div className="summary-card stat">
                          <div className="summary-item">
                            <span className="label">Amount</span>
                            <span className="value">${formatAmount(bet.stake)}
                              <span className="info-icon" title="Stake amount">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                                  <path d="M12 17v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  <circle cx="12" cy="8" r="1.5" fill="currentColor" />
                                </svg>
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="summary-card stat">
                          <div className="summary-item">
                            <span className="label">Possible Payout</span>
                            <span className="value">${formatAmount(bet.potentialWin)}
                              <span className="info-icon" title="Max payout based on odds">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                                  <path d="M12 17v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  <circle cx="12" cy="8" r="1.5" fill="currentColor" />
                                </svg>
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="summary-card stat">
                          <div className="summary-item">
                            <span className="label">Won/Lost/Total</span>
                            <span className="value">{wonCount}/{lostCount}/{totalCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Match Details - Card layout */}
                    <div className="full-page-matches">
                      <h3>Match Details</h3>
                      <div className="matches-card-list">
                        {displayMatches.map((match, index) => {
                          const ft = getFtResult(match);
                          const pick = parsePick(match?.selection, match?.point, match);
                          const typeLabel = (() => {
                            // Prefer explicit market header from each match entry
                            if (pick && pick.kind === 'correct_score') return 'Correct Score';
                            const selText = match?.selection ? String(match.selection) : '';
                            if (/^\s*\d+\s*-\s*\d+\s*$/.test(selText) && !/goals?/i.test(selText)) return 'Correct Score';
                            const matchMarketDisplay = match?.marketTypeDisplay || match?.marketDisplay || null;
                            if (matchMarketDisplay) return matchMarketDisplay;
                            const matchMarketKey = match?.market || '';
                            if (matchMarketKey) {
                              const norm = normalizeMarketKey(matchMarketKey);
                              if (norm === 'winner') return 'Winner';
                              if (norm.startsWith('totals') || norm.startsWith('alternate_totals') || norm.startsWith('team_totals') || norm.startsWith('alternate_team_totals')) return 'Over/Under';
                              if (norm.startsWith('spreads') || norm.startsWith('alternate_spreads')) return 'Handicap';
                              if (norm === 'outrights') return 'Outrights';
                              return getMarketTitle(norm);
                            }
                            // Fallback to parsed pick if market context is missing
                            if (pick && pick.kind) {
                              if (pick.kind === 'winner') return 'Winner';
                              if (pick.kind === 'totals') return 'Over/Under';
                              if (pick.kind === 'handicap') return 'Handicap';
                              if (pick.kind === 'btts') return 'Both Teams to Score';
                              if (pick.kind === 'corners_totals') return 'Corners';
                              if (pick.kind === 'cards_totals') return 'Cards';
                              if (pick.kind === 'odd_even') return 'Odd/Even';
                              if (pick.kind === 'multi_goals') return 'Multi Goals';
                            }
                            // Heuristic: handicap selections like "Team (-9)" without explicit market
                            const sel = match?.selection || '';
                            const hasSignedPoint = /\(\s*[-+]\d+(?:\.\d+)?\s*\)/.test(sel);
                            const mentionsTotals = /\b(over|under|ov|und|o|u)\b/i.test(sel);
                            if (hasSignedPoint && !mentionsTotals) return 'Handicap';
                            // Final fallback: inspect parent bet.market for canonical mapping
                            const parentKey = normalizeMarketKey(bet?.market || '');
                            if (parentKey) {
                              if (parentKey === 'winner') return 'Winner';
                              if (parentKey.startsWith('totals') || parentKey.startsWith('alternate_totals') || parentKey.startsWith('team_totals') || parentKey.startsWith('alternate_team_totals')) return 'Over/Under';
                              if (parentKey.startsWith('spreads') || parentKey.startsWith('alternate_spreads')) return 'Handicap';
                              if (parentKey === 'both_teams_to_score') return 'Both Teams to Score';
                              if (parentKey === 'correct_score') return 'Correct Score';
                              if (parentKey === 'multi_goals') return 'Multi Goals';
                              if (parentKey === 'corners') return 'Corners';
                              if (parentKey === 'cards') return 'Cards';
                              return getMarketTitle(parentKey) || 'Winner';
                            }
                            return 'Winner';
                          })();

                          return (
                            <div className="match-card-row" key={index}>
                              <div className="match-row-header">
                                <span className="team home-team">{match.homeTeam}</span>
                                <span className="vs-separator">vs</span>
                                <span className="team away-team">{match.awayTeam}</span>
                                {match.derivedStatus === 'won' ? (
                                  <span className="status-icon won" aria-label="Won">
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M20 6L9 17L4 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </span>
                                ) : match.derivedStatus === 'lost' ? (
                                  <span className="status-icon lost" aria-label="Lost">
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                  </span>
                                ) : match.derivedStatus === 'void' ? (
                                  <span className="status-icon void" aria-label="Void">–</span>
                                ) : (
                                  <span className="status-icon pending" aria-label="Pending">•</span>
                                )}
                              </div>
                              <div className="match-row-body">
                                <div className="body-item">
                                  <span className="label">Type</span>
                                  <span className="value">{typeLabel}</span>
                                </div>
                                <div className="body-item">
                                  <span className="label">FT Results</span>
                                  <span className="value">{ft}</span>
                                </div>
                                <div className="body-item">
                                  <span className="label">Pick</span>
                                  <span className="value">{match.selection}{match.odds ? ` (${formatOdds(match.odds)})` : ''}</span>
                                </div>
                                <div className="body-item">
                                  <span className="label">Outcome</span>
                                  <span className="value">{match.derivedOutcome || '—'}</span>
                                </div>
                                {/* Status text removed per request; icon shown in header */}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bets;
