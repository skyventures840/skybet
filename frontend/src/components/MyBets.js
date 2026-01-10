import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import apiService from '../services/api';

// Memoized BetCard component for better performance
const BetCard = memo(({ bet, getStatusInfo, formatCurrency, formatDate, onCancel }) => {
  const statusInfo = getStatusInfo(bet.status);
  
  const canCancel = useMemo(() => {
    return bet.matches.every(m => m.status === 'Pending');
  }, [bet.matches]);

  return (
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${statusInfo.borderColor}`}>
      {/* Bet Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {statusInfo.icon}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Betslip #{bet.betslipId}
            </h3>
            <p className="text-sm text-gray-500">
              Submitted {formatDate(bet.submittedAt)}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`text-lg font-bold ${statusInfo.color}`}>
            {bet.status}
          </div>
          <div className="text-sm text-gray-500">
            {bet.totalMatches} matches
          </div>
          {onCancel && canCancel && (
            <button 
              onClick={() => onCancel(bet._id)}
              className="mt-2 text-sm text-red-600 hover:text-red-800 hover:underline font-medium transition-colors"
            >
              Cancel Bet
            </button>
          )}
        </div>
      </div>
      
      {/* Bet Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-600 mb-1">Stake</div>
          <div className="text-lg font-semibold text-gray-900">
            {formatCurrency(bet.stake, bet.currency)}
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-600 mb-1">Combined Odds</div>
          <div className="text-lg font-semibold text-green-600">
            {bet.combinedOdds.toFixed(2)}
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-600 mb-1">Potential Payout</div>
          <div className="text-lg font-semibold text-gray-900">
            {formatCurrency(bet.potentialPayout, bet.currency)}
          </div>
        </div>
      </div>
      
      {/* Matches List */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Matches:</h4>
        {bet.matches.map((match, index) => (
          <MatchCard key={match.matchId} match={match} index={index} />
        ))}
      </div>
    </div>
  );
});

// Memoized MatchCard component
const MatchCard = memo(({ match, index }) => (
  <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-300">
    <div className="flex items-center space-x-2 mb-1">
      <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">
        Match {index + 1}
      </span>
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
        match.status === 'Win' ? 'bg-green-100 text-green-800' :
        match.status === 'Loss' ? 'bg-red-100 text-red-800' :
        'bg-yellow-100 text-yellow-800'
      }`}>
        {match.status}
      </span>
    </div>
    
    <div className="font-medium text-gray-800 mb-1">
      {match.homeTeam} vs {match.awayTeam}
    </div>
    
    <div className="text-sm text-gray-600 mb-2">
      {match.league}
    </div>
    
    <div className="text-sm text-gray-700">
      <span className="font-medium">
        {match.outcome === '1' ? 'Home Win' : 
         match.outcome === 'X' ? 'Draw' : 'Away Win'}
      </span>
      {(() => {
        const r = match.result;
        const isFinal = !!(r && (r.isFinal === true || (typeof r.homeScore === 'number' && typeof r.awayScore === 'number')));
        if (!isFinal) return null;
        const hs = typeof r.homeScore === 'number' ? r.homeScore : '-';
        const as = typeof r.awayScore === 'number' ? r.awayScore : '-';
        return (
          <span className="ml-2 font-bold text-gray-900">
            ({hs}-{as})
          </span>
        );
      })()}
      <span className="ml-2 text-green-600 font-bold">
        @ {(() => {
          const o = match.odds;
          if (typeof o === 'number') return o.toFixed(2);
          if (typeof o === 'string') {
            const n = parseFloat(o);
            return Number.isFinite(n) ? n.toFixed(2) : '-';
          }
          return '-';
        })()}
      </span>
    </div>
  </div>
));

const MyBets = () => {
  const [multiBets, setMultiBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Fetch bets from both APIs and merge
  const fetchBets = useCallback(async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      
      // Fetch both Ordinary/Express bets (Bet model) and legacy MultiBets (MultiBet model)
      const [userBetsResponse, multiBetsResponse] = await Promise.allSettled([
        apiService.getUserBets({ limit: 50, excludeMarket: 'Aviator' }),
        apiService.getMultiBets({ limit: 50 })
      ]);

      let allBets = [];

      // Process User Bets (Ordinary & New Express)
      if (userBetsResponse.status === 'fulfilled' && userBetsResponse.value?.data?.bets) {
        const mappedUserBets = userBetsResponse.value.data.bets.map(bet => {
          // Normalize status
          let status = 'Pending';
          if (bet.status === 'won') status = 'Win';
          if (bet.status === 'lost') status = 'Loss';
          if (bet.status === 'void') status = 'Void';
          if (bet.status === 'cancelled') status = 'Cancelled';
          
          return {
            _id: bet.id, // bet.id is returned from backend
            betslipId: bet.id.substring(0, 8).toUpperCase(),
            submittedAt: bet.createdAt,
            status: status,
            stake: bet.stake,
            currency: 'USD', // Default to USD as it's not always in response
            combinedOdds: typeof bet.odds === 'object' ? bet.odds.selected : bet.odds,
            potentialPayout: bet.potentialWin,
            totalMatches: bet.matches ? bet.matches.length : 1,
            matches: (bet.matches || []).map(m => ({
              ...m,
              league: m.league || bet.match?.competition || 'Unknown League',
              result: m.result || (bet.result && bet.result.homeScore !== undefined ? bet.result : null)
            })),
            isMultiBet: bet.market === 'parlay' || (bet.matches && bet.matches.length > 1),
            source: 'bet'
          };
        });
        allBets = [...allBets, ...mappedUserBets];
      }

      // Process Legacy MultiBets
      if (multiBetsResponse.status === 'fulfilled' && multiBetsResponse.value?.data?.success) {
        const mappedMultiBets = (multiBetsResponse.value.data.data || []).map(bet => ({
          ...bet,
          betslipId: bet._id.substring(0, 8).toUpperCase(),
          submittedAt: bet.createdAt || bet.submittedAt, // Fallback
          // Status is already Title Case in MultiBet model usually
          matches: bet.matches.map(m => ({
            ...m,
            // Ensure result structure consistency if needed
          })),
          source: 'multibet'
        }));
        allBets = [...allBets, ...mappedMultiBets];
      }

      // Sort by date descending
      allBets.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

      setMultiBets(allBets);

      // Handle errors if both failed
      if (userBetsResponse.status === 'rejected' && multiBetsResponse.status === 'rejected') {
        setError('Failed to fetch bets');
      }
    } catch (err) {
      console.error('Fetch bets error:', err);
      setError('An error occurred while fetching bets');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchBets();
  }, []);
  
  // Handle bet cancellation
  const handleCancelBet = useCallback(async (betId) => {
    if (!window.confirm('Are you sure you want to cancel this bet? The stake will be refunded to your balance.')) {
      return;
    }

    const bet = multiBets.find(b => b._id === betId);
    if (!bet) return;

    try {
      setLoading(true);
      let response;
      if (bet.source === 'multibet') {
        response = await apiService.cancelMultiBet(betId);
      } else {
        response = await apiService.cancelBet(betId);
      }

      if (response.data.success) {
        // Refresh bets list
        fetchBets();
      } else {
        setError(response.data.message || 'Failed to cancel bet');
        setLoading(false);
      }
    } catch (err) {
      console.error('Cancel bet error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to cancel bet';
      setError(msg);
      setLoading(false);
    }
  }, [fetchBets, multiBets]);

  // Memoized status info to avoid recreating objects
  const getStatusInfo = useMemo(() => {
    const statusMap = {
      'Win': {
        icon: <CheckCircle className="w-5 h-5 text-green-500" />,
        color: 'text-green-500',
        borderColor: 'border-green-200'
      },
      'Loss': {
        icon: <XCircle className="w-5 h-5 text-red-500" />,
        color: 'text-red-500',
        borderColor: 'border-red-200'
      },
      'Pending': {
        icon: <Clock className="w-5 h-5 text-yellow-500" />,
        color: 'text-yellow-500',
        borderColor: 'border-yellow-200'
      },
      'default': {
        icon: <AlertCircle className="w-5 h-5 text-gray-500" />,
        color: 'text-gray-500',
        borderColor: 'border-gray-200'
      }
    };
    
    return (status) => statusMap[status] || statusMap.default;
  }, []);
  
  // Memoized formatters
  const formatCurrency = useCallback((amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }, []);
  
  const formatDate = useCallback((dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);
  
  // Memoized bet statistics
  const betStats = useMemo(() => {
    if (!multiBets.length) return null;
    
    const stats = {
      total: multiBets.length,
      wins: 0,
      losses: 0,
      pending: 0,
      totalStake: 0,
      totalPayout: 0
    };
    
    multiBets.forEach(bet => {
      stats.totalStake += bet.stake || 0;
      switch (bet.status) {
        case 'Win':
          stats.wins++;
          stats.totalPayout += bet.potentialPayout || 0;
          break;
        case 'Loss':
          stats.losses++;
          break;
        case 'Pending':
          stats.pending++;
          break;
      }
    });
    
    return stats;
  }, [multiBets]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Bets</h1>
          <p className="text-gray-600">Track your multi-bet history and performance</p>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}
        
        {/* Multi-Bets List */}
        <div className="space-y-4">
          {multiBets.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bets found</h3>
              <p className="text-gray-500">You haven't placed any multi-bets yet.</p>
            </div>
          ) : (
            multiBets.map((bet) => (
              <BetCard
                key={bet._id}
                bet={bet}
                getStatusInfo={getStatusInfo}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                onCancel={handleCancelBet}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(MyBets);
