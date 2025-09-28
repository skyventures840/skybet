import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, Plus, Minus, Calculator, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

const EnhancedBetslip = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('multi'); // 'single' or 'multi'
  const [stake, setStake] = useState(10.00);
  const [currency, setCurrency] = useState('USD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Get selected bets from Redux store
  const selectedBets = useSelector(state => state.activeBets.bets);
  const [multiBetMatches, setMultiBetMatches] = useState([]);
  
  // Calculate combined odds and potential payout
  const combinedOdds = useCallback(() => {
    if (multiBetMatches.length < 2) return 0;
    return multiBetMatches.reduce((total, match) => total * match.odds, 1);
  }, [multiBetMatches]);
  
  const potentialPayout = useCallback(() => {
    return combinedOdds() * stake;
  }, [combinedOdds, stake]);
  
  // Handle stake input changes
  const handleStakeChange = (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0.01 && value <= 10000) {
      setStake(value);
      setError('');
    }
  };
  
  // Quick stake buttons
  const quickStakes = [5, 10, 25, 50, 100, 250, 500, 1000];
  
  // Add bet to multi-bet
  const addToMultiBet = (bet) => {
    // Check if match already exists
    const exists = multiBetMatches.find(match => match.matchId === bet.matchId);
    if (exists) {
      setError('This match is already in your multi-bet');
      return;
    }
    
    // Check if match starts in the future
    const matchTime = new Date(bet.startTime);
    const now = new Date();
    if (matchTime <= now) {
      setError('Cannot add matches that have already started');
      return;
    }
    
    const newMatch = {
      matchId: bet.matchId,
      homeTeam: bet.homeTeam,
      awayTeam: bet.awayTeam,
      league: bet.league,
      startTime: bet.startTime,
      outcome: bet.type,
      odds: bet.odds,
      status: 'Pending'
    };
    
    setMultiBetMatches(prev => [...prev, newMatch]);
    setError('');
    setSuccess('Match added to multi-bet successfully');
    
    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(''), 3000);
  };
  
  // Remove match from multi-bet
  const removeFromMultiBet = (matchId) => {
    setMultiBetMatches(prev => prev.filter(match => match.matchId !== matchId));
  };
  
  // Clear all matches
  const clearMultiBet = () => {
    setMultiBetMatches([]);
    setStake(10.00);
    setError('');
  };
  
  // Submit multi-bet
  const submitMultiBet = async () => {
    if (multiBetMatches.length < 2) {
      setError('At least 2 matches are required for a multi-bet');
      return;
    }
    
    if (stake < 0.01) {
      setError('Minimum stake is $0.01');
      return;
    }
    
    if (stake > 10000) {
      setError('Maximum stake is $10,000');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const multiBetData = {
        matches: multiBetMatches,
        stake,
        currency
      };
      
      // Call API to submit multi-bet
      const response = await fetch('/api/multibets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(multiBetData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess('Multi-bet submitted successfully!');
        clearMultiBet();
        
        // Clear success message and close betslip after 3 seconds
        setTimeout(() => {
          setSuccess('');
          onClose();
        }, 3000);
      } else {
        setError(result.message || 'Failed to submit multi-bet');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Multi-bet submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };
  
  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Get outcome display text
  const getOutcomeText = (outcome) => {
    switch (outcome) {
      case '1': return 'Home Win';
      case 'X': return 'Draw';
      case '2': return 'Away Win';
      default: return outcome;
    }
  };
  
  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Win': return 'text-green-500';
      case 'Loss': return 'text-red-500';
      case 'Pending': return 'text-yellow-500';
      case 'Void': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };
  
  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Win': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Loss': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'Pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'Void': return <XCircle className="w-4 h-4 text-gray-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calculator className="w-6 h-6" />
            <h2 className="text-xl font-bold">Enhanced Betslip</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('multi')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'multi'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Multi-Bet
          </button>
          <button
            onClick={() => setActiveTab('single')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'single'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Single Bet
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'multi' ? (
            /* Multi-Bet Tab */
            <div className="space-y-6">
              {/* Available Bets Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">
                  Available Bets ({selectedBets.length})
                </h3>
                {selectedBets.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No bets selected. Browse matches and click on odds to add them.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedBets.map((bet, index) => (
                      <div
                        key={index}
                        className="bg-white rounded-lg p-3 border border-gray-200 hover:border-green-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">
                              {bet.homeTeam} vs {bet.awayTeam}
                            </div>
                            <div className="text-sm text-gray-600">
                              {bet.league} • {formatDate(bet.startTime)}
                            </div>
                            <div className="text-sm text-gray-700 mt-1">
                              <span className="font-medium">{getOutcomeText(bet.type)}</span>
                              <span className="ml-2 text-green-600 font-bold">
                                @ {bet.odds.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => addToMultiBet(bet)}
                            className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition-colors"
                            title="Add to Multi-Bet"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Multi-Bet Matches */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Multi-Bet Matches ({multiBetMatches.length})
                  </h3>
                  {multiBetMatches.length > 0 && (
                    <button
                      onClick={clearMultiBet}
                      className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                
                {multiBetMatches.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Add matches from available bets to create your multi-bet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {multiBetMatches.map((match, index) => (
                      <div
                        key={match.matchId}
                        className="bg-white rounded-lg p-4 border border-gray-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                                Match {index + 1}
                              </span>
                              <span className="text-sm text-gray-500">
                                {formatDate(match.startTime)}
                              </span>
                            </div>
                            <div className="font-medium text-gray-800 mb-1">
                              {match.homeTeam} vs {match.awayTeam}
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              {match.league}
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className="text-sm text-gray-700">
                                <span className="font-medium">{getOutcomeText(match.outcome)}</span>
                              </span>
                              <span className="text-green-600 font-bold">
                                @ {match.odds.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromMultiBet(match.matchId)}
                            className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="Remove from Multi-Bet"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Bet Summary */}
              {multiBetMatches.length >= 2 && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h3 className="text-lg font-semibold text-green-800 mb-3">
                    Bet Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Combined Odds:</span>
                      <span className="ml-2 font-bold text-green-600">
                        {combinedOdds().toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Matches:</span>
                      <span className="ml-2 font-bold text-gray-800">
                        {multiBetMatches.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Stake Input */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Stake & Payout
                </h3>
                <div className="space-y-4">
                  {/* Currency Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD (C$)</option>
                      <option value="AUD">AUD (A$)</option>
                    </select>
                  </div>
                  
                  {/* Stake Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stake Amount
                    </label>
                    <input
                      type="number"
                      value={stake}
                      onChange={handleStakeChange}
                      min="0.01"
                      max="10000"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter stake amount"
                    />
                  </div>
                  
                  {/* Quick Stake Buttons */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quick Stake
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {quickStakes.map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setStake(amount)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            stake === amount
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {formatCurrency(amount)}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Potential Payout */}
                  {multiBetMatches.length >= 2 && (
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Potential Payout</div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(potentialPayout())}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {multiBetMatches.length} matches × {formatCurrency(stake)} stake
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Error & Success Messages */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-red-700">{error}</span>
                </div>
              )}
              
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-700">{success}</span>
                </div>
              )}
              
              {/* Submit Button */}
              <button
                onClick={submitMultiBet}
                disabled={multiBetMatches.length < 2 || isSubmitting}
                className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                  multiBetMatches.length >= 2 && !isSubmitting
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Multi-Bet'}
              </button>
            </div>
          ) : (
            /* Single Bet Tab */
            <div className="text-center py-8">
              <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Single Bet Mode
              </h3>
              <p className="text-gray-600">
                Single bet functionality will be implemented here.
                <br />
                For now, use the Multi-Bet tab to place multiple match bets.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedBetslip;
