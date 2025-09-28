import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const MyBets = () => {
  const [multiBets, setMultiBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Fetch multi-bets from API
  const fetchMultiBets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/multibets', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setMultiBets(result.data);
      } else {
        setError(result.message || 'Failed to fetch multi-bets');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Fetch multi-bets error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchMultiBets();
  }, []);
  
  // Get status display info
  const getStatusInfo = (status) => {
    switch (status) {
      case 'Win':
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          color: 'text-green-500',
          borderColor: 'border-green-200'
        };
      case 'Loss':
        return {
          icon: <XCircle className="w-5 h-5 text-red-500" />,
          color: 'text-red-500',
          borderColor: 'border-red-200'
        };
      case 'Pending':
        return {
          icon: <Clock className="w-5 h-5 text-yellow-500" />,
          color: 'text-yellow-500',
          borderColor: 'border-yellow-200'
        };
      default:
        return {
          icon: <AlertCircle className="w-5 h-5 text-gray-500" />,
          color: 'text-gray-500',
          borderColor: 'border-gray-200'
        };
    }
  };
  
  // Format currency
  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };
  
  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
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
            multiBets.map((bet) => {
              const statusInfo = getStatusInfo(bet.status);
              
              return (
                <div
                  key={bet._id}
                  className={`bg-white rounded-lg shadow p-6 border-l-4 ${statusInfo.borderColor}`}
                >
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
                      <div
                        key={match.matchId}
                        className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-300"
                      >
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
                          <span className="ml-2 text-green-600 font-bold">
                            @ {match.odds.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MyBets;
