import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';

const ManageMatches = () => {
  const [matches, setMatches] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [formData, setFormData] = useState({
    leagueName: '',
    sport: '',
    homeTeam: '',
    awayTeam: '',
    startTime: '',
    status: 'upcoming',
    homeScore: null,
    awayScore: null,
    odds: {},
    videoUrl: '',
    videoPosterUrl: ''
  });
  const [showAddLeague, setShowAddLeague] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [autoLeagueId, setAutoLeagueId] = useState('');
  const [autoExternalId, setAutoExternalId] = useState('');
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [selectedMatches, setSelectedMatches] = useState([]);
  const [allMatchesSelected, setAllMatchesSelected] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [resultHomeScore, setResultHomeScore] = useState(0);
  const [resultAwayScore, setResultAwayScore] = useState(0);
  const [resultCompleted, setResultCompleted] = useState(true);
  // Extended result state
  const [resultHomeScoreHT, setResultHomeScoreHT] = useState('');
  const [resultAwayScoreHT, setResultAwayScoreHT] = useState('');
  const [resultHomeCorners, setResultHomeCorners] = useState('');
  const [resultAwayCorners, setResultAwayCorners] = useState('');
  const [resultHomeCards, setResultHomeCards] = useState('');
  const [resultAwayCards, setResultAwayCards] = useState('');
  const [resultPenaltyAwarded, setResultPenaltyAwarded] = useState(false);
  const [resultFirstGoalscorer, setResultFirstGoalscorer] = useState('');
  const [resultAnytimeGoalscorers, setResultAnytimeGoalscorers] = useState('');
  const [resultLastGoalscorer, setResultLastGoalscorer] = useState('');
  
  const [scheduledEvents, setScheduledEvents] = useState([]);
  const [openActionId, setOpenActionId] = useState(null);
  const [activeOddsTab, setActiveOddsTab] = useState('main');

  // Helper for dynamic odds lists (e.g. Correct Score)
  const handleDynamicOddsChange = (marketKey, index, field, value) => {
    const currentList = Array.isArray(formData.odds[marketKey]) ? formData.odds[marketKey] : [];
    const newList = [...currentList];
    if (!newList[index]) newList[index] = {};
    newList[index][field] = value;
    setFormData({ ...formData, odds: { ...formData.odds, [marketKey]: newList } });
  };

  const addDynamicOddItem = (marketKey, defaultItem = {}) => {
    const currentList = Array.isArray(formData.odds[marketKey]) ? formData.odds[marketKey] : [];
    setFormData({ ...formData, odds: { ...formData.odds, [marketKey]: [...currentList, defaultItem] } });
  };

  const removeDynamicOddItem = (marketKey, index) => {
    const currentList = Array.isArray(formData.odds[marketKey]) ? formData.odds[marketKey] : [];
    const newList = currentList.filter((_, i) => i !== index);
    setFormData({ ...formData, odds: { ...formData.odds, [marketKey]: newList } });
  };

  // Custom Markets Handlers
  const addCustomMarket = () => {
    const currentList = Array.isArray(formData.odds.customMarkets) ? formData.odds.customMarkets : [];
    const newMarket = { id: Date.now(), name: '', options: [] };
    setFormData({ ...formData, odds: { ...formData.odds, customMarkets: [...currentList, newMarket] } });
  };

  const removeCustomMarket = (index) => {
    const currentList = Array.isArray(formData.odds.customMarkets) ? formData.odds.customMarkets : [];
    const newList = currentList.filter((_, i) => i !== index);
    setFormData({ ...formData, odds: { ...formData.odds, customMarkets: newList } });
  };

  const updateCustomMarketName = (index, name) => {
    const currentList = Array.isArray(formData.odds.customMarkets) ? formData.odds.customMarkets : [];
    const newList = [...currentList];
    newList[index] = { ...newList[index], name };
    setFormData({ ...formData, odds: { ...formData.odds, customMarkets: newList } });
  };

  const addCustomMarketOption = (marketIndex) => {
    const currentList = Array.isArray(formData.odds.customMarkets) ? formData.odds.customMarkets : [];
    const newList = [...currentList];
    const currentOptions = Array.isArray(newList[marketIndex].options) ? newList[marketIndex].options : [];
    newList[marketIndex] = { ...newList[marketIndex], options: [...currentOptions, { name: '', odds: '' }] };
    setFormData({ ...formData, odds: { ...formData.odds, customMarkets: newList } });
  };

  const removeCustomMarketOption = (marketIndex, optionIndex) => {
    const currentList = Array.isArray(formData.odds.customMarkets) ? formData.odds.customMarkets : [];
    const newList = [...currentList];
    const currentOptions = Array.isArray(newList[marketIndex].options) ? newList[marketIndex].options : [];
    newList[marketIndex] = { ...newList[marketIndex], options: currentOptions.filter((_, i) => i !== optionIndex) };
    setFormData({ ...formData, odds: { ...formData.odds, customMarkets: newList } });
  };

  const updateCustomMarketOption = (marketIndex, optionIndex, field, value) => {
    const currentList = Array.isArray(formData.odds.customMarkets) ? formData.odds.customMarkets : [];
    const newList = [...currentList];
    const currentOptions = Array.isArray(newList[marketIndex].options) ? newList[marketIndex].options : [];
    const newOptions = [...currentOptions];
    newOptions[optionIndex] = { ...newOptions[optionIndex], [field]: value };
    newList[marketIndex] = { ...newList[marketIndex], options: newOptions };
    setFormData({ ...formData, odds: { ...formData.odds, customMarkets: newList } });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openActionId && !event.target.closest('.action-dropdown-container')) {
        setOpenActionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openActionId]);

  useEffect(() => {
    fetchMatches();
    fetchLeagues();
    fetchSports();
  }, []);


  const fetchMatches = async () => {
    try {
      setLoading(true);
      // Fetch from matches collection for admin management (includes odds and predetermined results)
      const response = await apiService.getAllMatches();
      const allMatches = response.data?.matches || [];
      
      // Normalize match format
      const normalized = allMatches.map(match => {
        try {
          return {
            _id: match._id,
            externalId: match.externalId,
            sport: match.sport || 'football',
            sportTitle: match.leagueId?.name || match.sport || '',
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            startTime: match.startTime,
            status: match.status,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            odds: match.odds || {},
            videoUrl: match.videoUrl,
            videoPosterUrl: match.videoPosterUrl,
            predeterminedResult: match.predeterminedResult || {}
          };
        } catch (e) {
          console.error('Error normalizing match:', match, e);
          return null;
        }
      }).filter(m => m !== null);
      
      setMatches(normalized);
    } catch (err) {
      console.error('Fetch matches error:', err);
      setError('Failed to fetch matches: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchLeagues = async () => {
    try {
      const res = await apiService.getLeagues();
      setLeagues(res.data);
    } catch (err) {
      setError('Failed to fetch leagues.');
    }
  };
  
  const fetchSports = async () => {
    try {
      const res = await apiService.getSports();
      const list = Array.isArray(res.data) ? res.data : [];
      setSports(list);
    } catch (err) {
      // Keep manual entry available if sports list fails
    }
  };

  // Auto-generate leagueId and externalId
  useEffect(() => {
    let leagueName = showAddLeague ? newLeagueName : formData.leagueName;
    if (!leagueName) {
      setAutoLeagueId('');
      setAutoExternalId('');
    // no-op
      return;
    }
    // leagueId: lowercase, hyphenated
    const leagueId = leagueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    // externalPrefix: first letters of each word, up to 4 chars
    const prefix = leagueName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);
    setAutoLeagueId(leagueId);
    // Find max externalId for this league
    const leagueMatches = matches.filter(m => m.leagueId === leagueId && m.externalId && m.externalId.startsWith(prefix));
    let nextNum = 1;
    if (leagueMatches.length > 0) {
      const nums = leagueMatches.map(m => {
        const match = m.externalId.match(/_(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
      nextNum = Math.max(...nums) + 1;
    }
    setAutoExternalId(`${prefix}_${String(nextNum).padStart(3, '0')}`);
  }, [formData.leagueName, newLeagueName, showAddLeague, matches]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleResultChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      predeterminedResult: {
        ...(prev.predeterminedResult || {}),
        [name]: value
      }
    }));
  };

  const handleOddsChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, odds: { ...formData.odds, [name]: value } });
  };

  const addScheduledEvent = () => {
    setScheduledEvents([...scheduledEvents, { minute: 0, team: 'home', player: '', type: 'goal', description: '' }]);
  };

  const removeScheduledEvent = (index) => {
    const newEvents = [...scheduledEvents];
    newEvents.splice(index, 1);
    setScheduledEvents(newEvents);
  };

  const updateScheduledEvent = (index, field, value) => {
    const newEvents = [...scheduledEvents];
    newEvents[index] = { ...newEvents[index], [field]: value };
    setScheduledEvents(newEvents);
  };

  const handleCreateOrUpdateMatch = async (e) => {
    e.preventDefault();
    try {
      const leagueName = showAddLeague ? newLeagueName : formData.leagueName;
      const payload = {
        leagueName: leagueName || '',
        teams: {
          home: formData.homeTeam || 'Home',
          away: formData.awayTeam || 'Away'
        },
        startTime: formData.startTime ? new Date(formData.startTime).toISOString() : new Date().toISOString(),
        odds: formData.odds && Object.keys(formData.odds).length > 0 ? formData.odds : {},
        sport: (formData.sport || 'football').toLowerCase(),
        status: formData.status || 'upcoming',
        homeScore: formData.homeScore || 0,
        awayScore: formData.awayScore || 0,
        videoUrl: formData.videoUrl || undefined,
        videoPosterUrl: formData.videoPosterUrl || undefined,
        predeterminedResult: {
          ...formData.predeterminedResult,
          shouldSettle: true
        },
        scheduledEvents
      };
      if (currentMatch) {
        await apiService.updateMatch(currentMatch._id, payload);
        fetchMatches();
        closeModal();
      } else {
        const res = await apiService.addMatch(payload);
        const newId = res?.data?.id;
        if (newId) {
          // Stay in modal to allow immediate uploads
          setCurrentMatch({ _id: newId });
          setSaveMessage('Match saved. You can now upload the video/poster.');
          fetchMatches();
        } else {
          // Fallback: close if no id returned
          fetchMatches();
          closeModal();
        }
      }
      if (showAddLeague) {
        setShowAddLeague(false);
        setNewLeagueName('');
        apiService.invalidateCachePrefix('/admin/leagues');
        fetchLeagues();
      }
    } catch (err) {
      setError('Failed to save match.');
      console.error(err);
    }
  };

  const handleDeleteMatch = async (id) => {
    if (window.confirm('Are you sure you want to delete this match?')) {
      try {
        await apiService.deleteMatch(id);
        fetchMatches();
      } catch (err) {
        setError('Failed to delete match.');
        console.error(err);
      }
    }
  };

  const openCreateModal = () => {
    setCurrentMatch(null);
    setFormData({
      leagueName: '',
      sport: '',
      homeTeam: '',
      awayTeam: '',
      startTime: '',
      status: 'upcoming',
      homeScore: null,
      awayScore: null,
      odds: {
        // Pre-populate dynamic markets with one empty row for visibility
        handicaps: [{ line: '', homeOdds: '', awayOdds: '' }],
        correctScore: [{ score: '', odds: '' }],
        multiGoals: [{ range: '', odds: '' }],
        winningMargin: [{ margin: '', odds: '' }],
        goalScorers: [{ player: '', type: 'anytime', odds: '' }]
      },
      videoUrl: '',
      videoPosterUrl: '',
      predeterminedResult: {
        homeScore: '',
        awayScore: '',
        homeCorners: '',
        awayCorners: '',
        homeCards: '',
        awayCards: ''
      }
    });
    setScheduledEvents([]);
    setShowAddLeague(false);
    setNewLeagueName('');
    setActiveOddsTab('main'); // Reset tab
    setIsModalOpen(true);
  };

  const openEditModal = (match) => {
    setCurrentMatch(match);
    setScheduledEvents(match.scheduledEvents || []);
    setFormData({
      leagueName: leagues.find(l => l.leagueId === match.leagueId)?.name || match.leagueId?.name || match.leagueId || '',
      sport: match.sport,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      startTime: (() => {
        const d = new Date(match.startTime);
        const pad = (n) => String(n).padStart(2, '0');
        const y = d.getFullYear();
        const m = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        const h = pad(d.getHours());
        const min = pad(d.getMinutes());
        return `${y}-${m}-${day}T${h}:${min}`;
      })(),
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      odds: match.odds || {},
      videoUrl: match.videoUrl || '',
      videoPosterUrl: match.videoPosterUrl || '',
      predeterminedResult: match.predeterminedResult || {}
    });
    setShowAddLeague(false);
    setNewLeagueName('');
    setActiveOddsTab('main'); // Reset tab
    setIsModalOpen(true);
  };

  const openResultModal = (match) => {
    setCurrentMatch(match);
    setResultHomeScore(Number(match.homeScore ?? 0));
    setResultAwayScore(Number(match.awayScore ?? 0));
    setResultCompleted(true);
    
    // Pre-populate if available in predeterminedResult
    const pr = match.predeterminedResult || {};
    setResultHomeScoreHT(pr.homeScoreHT || '');
    setResultAwayScoreHT(pr.awayScoreHT || '');
    setResultHomeCorners(pr.homeCorners || '');
    setResultAwayCorners(pr.awayCorners || '');
    setResultHomeCards(pr.homeCards || '');
    setResultAwayCards(pr.awayCards || '');
    setResultPenaltyAwarded(!!pr.penaltyAwarded);
    setResultFirstGoalscorer(pr.firstGoalscorer || '');
    setResultAnytimeGoalscorers(pr.anytimeGoalscorers || '');
    setResultLastGoalscorer(pr.lastGoalscorer || '');

    setIsResultModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentMatch(null);
  };

  const closeResultModal = () => {
    setIsResultModalOpen(false);
    setCurrentMatch(null);
  };

  const handleUpdateResult = async (e) => {
    e.preventDefault();
    if (!currentMatch?._id) return;
    try {
      // Update results based on odds event id
      const resp = await apiService.updateOddsResult(currentMatch._id, {
        homeScore: Number(resultHomeScore),
        awayScore: Number(resultAwayScore),
        completed: Boolean(resultCompleted),
        // Extended fields
        homeScoreHT: resultHomeScoreHT ? Number(resultHomeScoreHT) : undefined,
        awayScoreHT: resultAwayScoreHT ? Number(resultAwayScoreHT) : undefined,
        homeCorners: resultHomeCorners ? Number(resultHomeCorners) : undefined,
        awayCorners: resultAwayCorners ? Number(resultAwayCorners) : undefined,
        homeCards: resultHomeCards ? Number(resultHomeCards) : undefined,
        awayCards: resultAwayCards ? Number(resultAwayCards) : undefined,
        penaltyAwarded: Boolean(resultPenaltyAwarded),
        firstGoalscorer: resultFirstGoalscorer || undefined,
        anytimeGoalscorers: resultAnytimeGoalscorers || undefined,
        lastGoalscorer: resultLastGoalscorer || undefined
      });
      const settled = resp?.data?.settlement;
      const msg = settled ? `Result saved. Settled ${settled.settledBets || 0} bets across ${settled.processedMatches || 0} matches.` : 'Result saved.';
      setSaveMessage(msg);
      // Refresh list to reflect any possible status changes elsewhere
      fetchMatches();
      setTimeout(() => setSaveMessage(''), 4000);
      closeResultModal();
    } catch (err) {
      console.error('Update result failed:', err);
      setSaveMessage(err?.response?.data?.error || 'Failed to update result');
      setTimeout(() => setSaveMessage(''), 4000);
    }
  };

  // Search/filter logic
  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchPerformed(true);
    const q = searchQuery.trim();
    try {
      if (q) {
        const lc = q.toLowerCase();
        const list = matches.filter(m =>
          (m.homeTeam && m.homeTeam.toLowerCase().includes(lc)) ||
          (m.awayTeam && m.awayTeam.toLowerCase().includes(lc)) ||
          (m.sportTitle && m.sportTitle.toLowerCase().includes(lc))
        );
        // Optional status filter applied on top
        const filtered = statusFilter ? list.filter(m => m.status === statusFilter) : list;
        setFilteredMatches(filtered);
        return;
      }
      // No query: filter locally by status only
      if (!statusFilter) {
        setFilteredMatches([]);
        return;
      }
      setFilteredMatches(matches.filter(m => m.status === statusFilter));
    } catch (err) {
      console.error('Search matches failed:', err);
      setFilteredMatches([]);
    }
  };

  // Add clear search function
  const handleClearSearch = () => {
    setSearchQuery('');
    setStatusFilter('');
    setSearchPerformed(false);
    setFilteredMatches([]);
  };

  // Add show all matches function
  const handleShowAll = async () => {
    setSearchQuery('');
    setStatusFilter('');
    setSearchPerformed(true);
    try {
      // Show normalized odds matches without filters
      setFilteredMatches(matches);
    } catch (err) {
      console.error('Show all matches failed:', err);
      setFilteredMatches(matches);
    }
  };

  // Bulk operations functions
  const handleSelectMatch = (matchId, checked) => {
    if (checked) {
      setSelectedMatches(prev => [...prev, matchId]);
    } else {
      setSelectedMatches(prev => prev.filter(id => id !== matchId));
      setAllMatchesSelected(false);
    }
  };

  const handleSelectAllMatches = (checked) => {
    if (checked) {
      const allMatchIds = (!searchPerformed ? matches : filteredMatches).map(match => match._id);
      setSelectedMatches(allMatchIds);
      setAllMatchesSelected(true);
    } else {
      setSelectedMatches([]);
      setAllMatchesSelected(false);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedMatches.length === 0) return;

    try {
      const promises = selectedMatches.map(matchId => {
        switch (bulkAction) {
          case 'delete':
            return apiService.deleteMatch(matchId);
          case 'status-upcoming':
            return apiService.updateMatch(matchId, { status: 'upcoming' });
          case 'status-live':
            return apiService.updateMatch(matchId, { status: 'live' });
          case 'status-finished':
            return apiService.updateMatch(matchId, { status: 'finished' });
          case 'status-cancelled':
            return apiService.updateMatch(matchId, { status: 'cancelled' });
          default:
            return Promise.resolve();
        }
      });

      await Promise.all(promises);
      setSaveMessage(`${bulkAction} action completed for ${selectedMatches.length} matches`);
      setSelectedMatches([]);
      setAllMatchesSelected(false);
      setBulkAction('');
      fetchMatches(); // Refresh the matches list
      
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Bulk action failed:', error);
      setSaveMessage('Bulk action failed');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Manage Matches</h2>
          <button
            onClick={openCreateModal}
            className="btn-export"
          >
            + Add New Match
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-filter flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search by team or league..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(e); }}
            className="search-input"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="search-input"
          >
            <option value="">All Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="finished">Finished</option>
            <option value="cancelled">Cancelled</option>
            <option value="postponed">Postponed</option>
          </select>
          <button
            type="submit"
            onClick={handleSearch}
            className="btn-refresh"
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleShowAll}
            className="btn-refresh"
          >
            Show All
          </button>
          {searchPerformed && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="btn-cancel"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-white text-center py-8">Loading matches...</div>
      ) : error ? (
        <div className="text-red-500 text-center py-8">
          <div className="mb-2">Error: {error}</div>
          <button onClick={fetchMatches} className="btn-refresh">Retry</button>
        </div>
      ) : (
        <>
          {/* Match Statistics */}
          <div className="mb-4 p-4 bg-gray-800 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-400">{matches.length}</div>
                <div className="text-sm text-gray-300">Total Matches</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{matches.filter(m => m.status === 'upcoming').length}</div>
                <div className="text-sm text-gray-300">Upcoming</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">{matches.filter(m => m.status === 'live').length}</div>
                <div className="text-sm text-gray-300">Live</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">{matches.filter(m => m.status === 'finished').length}</div>
                <div className="text-sm text-gray-300">Finished</div>
              </div>
            </div>
          </div>

          {/* Show table always, but with different data sources */}
          <div className="overflow-x-auto">
            {(!searchPerformed ? matches : filteredMatches).length === 0 ? (
              <div className="text-center py-8 text-gray-300">
                {!searchPerformed ? 'No matches found. Click "Show All" to view all matches.' : 'No matches found for your search.'}
              </div>
            ) : (

          <>
            {/* Desktop Table View */}
            <table className="admin-table hidden md:table w-full">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allMatchesSelected}
                      onChange={(e) => handleSelectAllMatches(e.target.checked)}
                    />
                  </th>
                  <th>Sport</th>
                  <th>Match</th>
                  <th>League</th>
                  <th>Start Time</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Odds</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!searchPerformed ? matches : filteredMatches).map((match) => (
                  <tr key={match._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedMatches.includes(match._id)}
                        onChange={(e) => handleSelectMatch(match._id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <span className="sport-badge">{match.sport}</span>
                    </td>
                    <td>
                      <div className="match-info">
                        <div className="teams max-w-[120px] md:max-w-[180px] lg:max-w-xs truncate" title={`${match.homeTeam} vs ${match.awayTeam}`}>
                          {match.homeTeam} vs {match.awayTeam}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="league max-w-[100px] md:max-w-[150px] lg:max-w-xs truncate" title={match.leagueId?.name || 'N/A'}>
                        {match.leagueId?.name || 'N/A'}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">{new Date(match.startTime).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-400">{new Date(match.startTime).toLocaleTimeString()}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${match.status}`}>
                        {match.status}
                      </span>
                    </td>
                    <td>
                      {match.homeScore != null && match.awayScore != null ? `${match.homeScore} - ${match.awayScore}` : 'N/A'}
                    </td>
                    <td>
                      <div className="odds-preview">
                        {match.odds && Object.keys(match.odds).length > 0 ? (
                          <span className="text-green-400 text-sm">✓ Set</span>
                        ) : (
                          <span className="text-gray-400 text-sm">Not set</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons relative action-dropdown-container">
                        <button
                          onClick={() => setOpenActionId(openActionId === match._id ? null : match._id)}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-cyan-400 flex items-center gap-1"
                        >
                          Actions ▼
                        </button>
                        {openActionId === match._id && (
                          <div className="absolute right-0 mt-1 w-32 bg-gray-800 border border-gray-600 rounded shadow-xl z-50">
                            <button
                              onClick={() => { setOpenActionId(null); openEditModal(match); }}
                              className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-700 text-white border-b border-gray-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { setOpenActionId(null); openResultModal(match); }}
                          className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-700 text-white border-b border-gray-700"
                        >
                          Set Result
                        </button>
                            <button
                              onClick={() => { setOpenActionId(null); handleDeleteMatch(match._id); }}
                              className="block w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-gray-700"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {(!searchPerformed ? matches : filteredMatches).map((match) => (
                <div key={match._id} className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedMatches.includes(match._id)}
                        onChange={(e) => handleSelectMatch(match._id, e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="sport-badge text-xs">{match.sport}</span>
                      <span className={`status-badge ${match.status} text-xs px-2 py-0.5`}>
                        {match.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">{new Date(match.startTime).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-400">{new Date(match.startTime).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="text-lg font-bold text-white mb-1 break-words">{match.homeTeam} vs {match.awayTeam}</div>
                    <div className="text-sm text-gray-400 break-words">{match.leagueId?.name || 'N/A'}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div className="bg-gray-700 p-2 rounded">
                      <div className="text-gray-300 text-xs">Score</div>
                      <div className="text-white font-mono">
                        {match.homeScore != null && match.awayScore != null ? `${match.homeScore} - ${match.awayScore}` : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-gray-700 p-2 rounded">
                      <div className="text-gray-300 text-xs">Odds</div>
                      <div>
                        {match.odds && Object.keys(match.odds).length > 0 ? (
                          <span className="text-green-400">✓ Set</span>
                        ) : (
                          <span className="text-gray-400">Not set</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-3 relative action-dropdown-container">
                    <button 
                    onClick={() => setOpenActionId(openActionId === match._id ? null : match._id)}
                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-cyan-400 flex items-center justify-center gap-2"
                  >
                    Actions ▼
                  </button>
                  {openActionId === match._id && (
                    <div className="absolute right-0 top-full mt-1 w-full bg-gray-800 border border-gray-600 rounded shadow-xl z-50">
                      <button 
                        onClick={() => { setOpenActionId(null); openEditModal(match); }}
                        className="block w-full text-left px-4 py-3 text-sm hover:bg-gray-700 text-gray-200 hover:text-white border-b border-gray-700"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => { setOpenActionId(null); openResultModal(match); }}
                        className="block w-full text-left px-4 py-3 text-sm hover:bg-gray-700 text-gray-200 hover:text-white border-b border-gray-700"
                      >
                        Set Result
                      </button>
                      <button 
                        onClick={() => { setOpenActionId(null); handleDeleteMatch(match._id); }}
                        className="block w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      </>
      )}

      {/* Bulk Actions */}
      {selectedMatches.length > 0 && (
        <div className="bulk-actions fixed bottom-4 left-4 right-4 bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 z-40">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-white font-bold">
              {selectedMatches.length} match(es) selected
            </span>
            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 w-full md:w-auto"
                style={{ color: 'white', backgroundColor: '#374151' }}
              >
                <option value="">Select Action</option>
                <option value="status-upcoming">Set Status: Upcoming</option>
                <option value="status-live">Set Status: Live</option>
                <option value="status-finished">Set Status: Finished</option>
                <option value="status-cancelled">Set Status: Cancelled</option>
                <option value="delete">Delete Matches</option>
              </select>
              <div className="flex gap-2 w-full md:w-auto">
                <button
                  onClick={handleBulkAction}
                  disabled={!bulkAction}
                  className="btn-export disabled:opacity-50 disabled:cursor-not-allowed flex-1 md:flex-none justify-center"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    setSelectedMatches([]);
                    setAllMatchesSelected(false);
                    setBulkAction('');
                  }}
                  className="btn-cancel flex-1 md:flex-none justify-center"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 overflow-y-auto">
          <div className="modal-content bg-white rounded-lg shadow-xl w-full max-w-4xl mx-auto my-8 flex flex-col max-h-[90vh]">
            <div className="modal-header p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-lg">
              <h3 className="text-xl font-bold text-black" style={{ color: 'black' }}>{currentMatch ? 'Edit Match' : 'Add New Match'}</h3>
              <button 
                className="modal-close text-gray-600 hover:text-gray-900 text-2xl font-bold"
                onClick={closeModal}
              >
                ×
              </button>
            </div>
            <div className="modal-body p-6 overflow-y-auto custom-scrollbar">
            {saveMessage && (
              <div className="mb-4 text-green-600 text-sm">{saveMessage}</div>
            )}
            <form onSubmit={handleCreateOrUpdateMatch} className="space-y-4">
              <div className="form-group">
                <label className="text-black font-bold" style={{ color: 'black' }}>League:</label>
                {!showAddLeague ? (
                  <div className="flex gap-2">
                    <select
                      name="leagueName"
                      value={formData.leagueName}
                      onChange={e => {
                        if (e.target.value === '__add_new__') {
                          setShowAddLeague(true);
                          setFormData({ ...formData, leagueName: '' });
                        } else {
                          setFormData({ ...formData, leagueName: e.target.value });
                        }
                      }}
                      className="bg-white text-black border border-gray-300 rounded px-2 py-1"
                      required
                    >
                      <option value="">Select League</option>
                      <option value="__add_new__" className="font-bold text-cyan-600">+ Add New League</option>
                      {leagues.map(l => (
                        <option key={l._id} value={l.name}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={newLeagueName}
                      onChange={e => setNewLeagueName(e.target.value)}
                      placeholder="Enter new league name"
                      className="bg-white text-black border border-gray-300 rounded px-2 py-1"
                      required
                    />
                    <button
                      type="button"
                      className="btn-cancel text-black border border-gray-300 px-2 py-1 rounded"
                      onClick={() => {
                        setShowAddLeague(false);
                        setNewLeagueName('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              {/* Video URL */}
              <div className="form-group">
                <label className="text-black font-bold" style={{ color: 'black' }}>Match Video (MP4/WebM)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-black" style={{ color: 'black' }}>Video URL:</label>
                    <input
                      type="url"
                      name="videoUrl"
                      placeholder="https://your-backend-url.onrender.com/uploads/videos/your-video.mp4"
                      value={formData.videoUrl}
                      onChange={handleInputChange}
                      className="w-full bg-white text-black border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-2 text-black" style={{ color: 'black' }}>Or upload video file:</label>
                  <input
                    type="file"
                        accept="video/mp4,video/webm,video/ogg"
                        disabled={false}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const fd = new FormData();
                          // Ensure field name matches backend 'upload.single(\'video\')'
                          fd.append('video', file, file.name);
                          if (currentMatch?._id) {
                            try {
                              const res = await apiService.uploadMatchVideo(currentMatch._id, fd);
                              setFormData(prev => ({ ...prev, videoUrl: res.data.videoUrl }));
                            } catch (err) {
                              try {
                                const res2 = await apiService.uploadMatchVideoFallback(currentMatch._id, fd);
                                setFormData(prev => ({ ...prev, videoUrl: res2.data.videoUrl }));
                              } catch (err2) {
                                // Final fallback to temp endpoints
                                try {
                                  const res3 = await apiService.uploadVideoTemp(fd);
                                  setFormData(prev => ({ ...prev, videoUrl: res3.data.videoUrl }));
                                } catch (err3) {
                                  try {
                                    const res4 = await apiService.uploadVideoTempFallback(fd);
                                    setFormData(prev => ({ ...prev, videoUrl: res4.data.videoUrl }));
                                  } catch (err4) {
                                    const msg = err4?.response?.data?.error || err4?.message || 'Failed to upload video';
                                    alert(msg);
                                    console.error('Video upload error:', err4);
                                  }
                                }
                              }
                            }
                          } else {
                            // Pre-save upload: use temp endpoints
                            try {
                              const res = await apiService.uploadVideoTemp(fd);
                              setFormData(prev => ({ ...prev, videoUrl: res.data.videoUrl }));
                            } catch (err) {
                              try {
                                const res2 = await apiService.uploadVideoTempFallback(fd);
                                setFormData(prev => ({ ...prev, videoUrl: res2.data.videoUrl }));
                              } catch (err2) {
                                const msg = err2?.response?.data?.error || err2?.message || 'Failed to upload video';
                                alert(msg);
                                console.error('Video upload error:', err2);
                              }
                            }
                          }
                        }}
                        className="block w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-200 file:text-black hover:file:bg-gray-300"
                      />
                      <div className="text-xs text-gray-500 mt-1">You can upload before or after saving; the URL is stored with the match.</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Poster URL */}
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                <label className="block text-sm font-bold mb-2 text-black" style={{ color: 'black' }}>Poster URL (thumbnail):</label>
                <input
                  type="url"
                      name="videoPosterUrl"
                      placeholder="https://your-backend-url.onrender.com/uploads/posters/poster.jpg"
                      value={formData.videoPosterUrl}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-gray-300"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-sm font-bold mb-2 text-black">Or upload poster image:</label>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={false}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const fd = new FormData();
                          // Ensure field name matches backend 'upload.single(\'poster\')'
                          fd.append('poster', file, file.name);
                          if (currentMatch?._id) {
                            try {
                              const res = await apiService.uploadMatchPoster(currentMatch._id, fd);
                              setFormData(prev => ({ ...prev, videoPosterUrl: res.data.videoPosterUrl }));
                            } catch (err) {
                              try {
                                const res2 = await apiService.uploadMatchPosterFallback(currentMatch._id, fd);
                                setFormData(prev => ({ ...prev, videoPosterUrl: res2.data.videoPosterUrl }));
                              } catch (err2) {
                                // Final fallback to temp endpoints
                                try {
                                  const res3 = await apiService.uploadPosterTemp(fd);
                                  setFormData(prev => ({ ...prev, videoPosterUrl: res3.data.videoPosterUrl }));
                                } catch (err3) {
                                  try {
                                    const res4 = await apiService.uploadPosterTempFallback(fd);
                                    setFormData(prev => ({ ...prev, videoPosterUrl: res4.data.videoPosterUrl }));
                                  } catch (err4) {
                                    const msg = err4?.response?.data?.error || err4?.message || 'Failed to upload poster';
                                    alert(msg);
                                    console.error('Poster upload error:', err4);
                                  }
                                }
                              }
                            }
                          } else {
                            // Pre-save upload: use temp endpoints
                            try {
                              const res = await apiService.uploadPosterTemp(fd);
                              setFormData(prev => ({ ...prev, videoPosterUrl: res.data.videoPosterUrl }));
                            } catch (err) {
                              try {
                                const res2 = await apiService.uploadPosterTempFallback(fd);
                                setFormData(prev => ({ ...prev, videoPosterUrl: res2.data.videoPosterUrl }));
                              } catch (err2) {
                                const msg = err2?.response?.data?.error || err2?.message || 'Failed to upload poster';
                                alert(msg);
                                console.error('Poster upload error:', err2);
                              }
                            }
                          }
                        }}
                        className="block w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-200 file:text-black hover:file:bg-gray-300"
                      />
                      <div className="text-xs text-gray-500 mt-1">You can upload before or after saving; the URL is stored with the match.</div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-black">League ID (auto):</label>
                <input
                  type="text"
                  value={autoLeagueId}
                  readOnly
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-gray-100 border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-black">External ID (auto):</label>
                <input
                  type="text"
                  value={autoExternalId}
                  readOnly
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-gray-100 border-gray-300"
                />
              </div>
              <div className="form-group">
                <label className="text-black font-bold" style={{ color: 'black' }}>Sport:</label>
                <select
                  name="sport"
                  value={formData.sport}
                  onChange={handleInputChange}
                  className="w-full bg-white text-black border border-gray-300 rounded px-2 py-1"
                  required
                >
                  <option value="">Select sport</option>
                  {(sports && sports.length > 0
                    ? sports.map(s => ({ key: (s.key || s.name || '').toLowerCase(), name: s.name || s.key }))
                    : [
                        { key: 'soccer', name: 'Soccer' },
                        { key: 'football', name: 'Football' },
                        { key: 'basketball', name: 'Basketball' },
                        { key: 'hockey', name: 'Hockey' },
                        { key: 'tennis', name: 'Tennis' },
                        { key: 'baseball', name: 'Baseball' }
                      ]
                  ).map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.name}</option>
                  ))}
                  {formData.sport && !(
                    (sports && sports.length > 0 && sports.some(s => (s.key || s.name || '').toLowerCase() === String(formData.sport).toLowerCase()))
                  ) && !['soccer','football','basketball','hockey','tennis','baseball'].includes(String(formData.sport).toLowerCase()) && (
                    <option value={String(formData.sport).toLowerCase()}>{formData.sport}</option>
                  )}
                </select>
              </div>
              <div className="form-group">
                <label className="text-black font-bold" style={{ color: 'black' }}>Home Team:</label>
                <input
                  type="text"
                  name="homeTeam"
                  value={formData.homeTeam}
                  onChange={handleInputChange}
                  className="w-full bg-white text-black border border-gray-300 rounded px-2 py-1"
                  required
                />
              </div>
              <div className="form-group">
                <label className="text-black font-bold" style={{ color: 'black' }}>Away Team:</label>
                <input
                  type="text"
                  name="awayTeam"
                  value={formData.awayTeam}
                  onChange={handleInputChange}
                  className="w-full bg-white text-black border border-gray-300 rounded px-2 py-1"
                  required
                />
              </div>
              <div className="form-group">
                <label className="text-black font-bold" style={{ color: 'black' }}>Start Time:</label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  className="w-full bg-white text-black border border-gray-300 rounded px-2 py-1"
                  required
                />
              </div>
              <div className="form-group">
                <label className="text-black font-bold" style={{ color: 'black' }}>Status:</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full bg-white text-black border border-gray-300 rounded px-2 py-1"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="finished">Finished</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="postponed">Postponed</option>
                </select>
              </div>
              <div className="form-group">
                <label className="text-black font-bold" style={{ color: 'black' }}>Home Score:</label>
                <input
                  type="number"
                  name="homeScore"
                  value={formData.homeScore || ''}
                  onChange={handleInputChange}
                  className="w-full bg-white text-black border border-gray-300 rounded px-2 py-1"
                />
              </div>
              <div className="form-group">
                <label className="text-black font-bold" style={{ color: 'black' }}>Away Score:</label>
                <input
                  type="number"
                  name="awayScore"
                  value={formData.awayScore || ''}
                  onChange={handleInputChange}
                  className="w-full bg-white text-black border border-gray-300 rounded px-2 py-1"
                />
              </div>
              {/* Odds Management with Tabs */}
              <div className="form-group border-t border-gray-300 pt-4">
                <label className="text-lg font-bold mb-2 block text-black">Market Management</label>
                
                {/* Tabs Navigation */}
                <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-300 pb-2 market-tabs">
                  <button type="button" onClick={() => setActiveOddsTab('main')} className={`px-4 py-2 rounded ${activeOddsTab === 'main' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}>Main Markets</button>
                  <button type="button" onClick={() => setActiveOddsTab('corners_cards')} className={`px-4 py-2 rounded ${activeOddsTab === 'corners_cards' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}>Corners & Cards</button>
                  <button type="button" onClick={() => setActiveOddsTab('custom')} className={`px-4 py-2 rounded ${activeOddsTab === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}>Custom</button>
                  <button type="button" onClick={() => setActiveOddsTab('results')} className={`px-4 py-2 rounded ${activeOddsTab === 'results' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}>Settlement Results</button>
                </div>

                {/* Main Markets Tab */}
                {activeOddsTab === 'main' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* 1X2 */}
                      <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                        <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>1X2 (Full Time Result / Match Winner)</label>
                        <div className="space-y-2">
                          <input type="number" step="0.01" name="homeWin" placeholder="Home win (1)" value={formData.odds.homeWin || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                          <input type="number" step="0.01" name="draw" placeholder="Draw (X)" value={formData.odds.draw || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                          <input type="number" step="0.01" name="awayWin" placeholder="Away win (2)" value={formData.odds.awayWin || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                      </div>

                      {/* Double Chance */}
                      <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                        <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>Double Chance</label>
                        <div className="space-y-2">
                          <input type="number" step="0.01" name="doubleChanceHomeDraw" placeholder="Home or Draw (1X)" value={formData.odds.doubleChanceHomeDraw || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                          <input type="number" step="0.01" name="doubleChanceHomeAway" placeholder="Home or Away (12)" value={formData.odds.doubleChanceHomeAway || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                          <input type="number" step="0.01" name="doubleChanceDrawAway" placeholder="Away or Draw (X2)" value={formData.odds.doubleChanceDrawAway || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                      </div>

                      {/* BTTS */}
                      <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                        <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>Both Teams to Score (BTTS)</label>
                        <div className="space-y-2">
                          <input type="number" step="0.01" name="bttsYes" placeholder="Yes (both score)" value={formData.odds.bttsYes || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                          <input type="number" step="0.01" name="bttsNo" placeholder="No" value={formData.odds.bttsNo || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                      </div>

                      {/* Odd/Even */}
                      <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                        <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>Odd/Even Goals</label>
                        <div className="space-y-2">
                          <input type="number" step="0.01" name="oddEvenOdd" placeholder="Odd" value={formData.odds.oddEvenOdd || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                          <input type="number" step="0.01" name="oddEvenEven" placeholder="Even" value={formData.odds.oddEvenEven || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                      </div>

                       {/* Penalty */}
                      <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                        <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>Penalty Yes/No</label>
                        <div className="space-y-2">
                          <input type="number" step="0.01" name="penaltyYes" placeholder="Yes" value={formData.odds.penaltyYes || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                          <input type="number" step="0.01" name="penaltyNo" placeholder="No" value={formData.odds.penaltyNo || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                      </div>

                      {/* Goals Over/Under */}
                      <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                        <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>Over/Under Goals</label>
                        <div className="space-y-2">
                          <input type="number" step="0.5" name="total" placeholder="Line (e.g. 2.5)" value={formData.odds.total || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                          <input type="number" step="0.01" name="over" placeholder="Over Odds" value={formData.odds.over || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                          <input type="number" step="0.01" name="under" placeholder="Under Odds" value={formData.odds.under || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-600 my-4"></div>

                    {/* Extended Markets */}
                    <div className="grid grid-cols-1 gap-4">
                      {/* Handicap (Dynamic) */}
                      <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                        <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>Handicap (Asian/European)</label>
                        <button type="button" onClick={() => addDynamicOddItem('handicaps', { line: '', homeOdds: '', awayOdds: '' })} className="bg-green-600 text-white px-2 py-1 rounded text-xs mb-2">+ Add Handicap Line</button>
                        <div className="space-y-2">
                          {(formData.odds.handicaps || []).map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <div className="w-1/3">
                                <label className="text-xs block text-black" style={{ color: 'black' }}>Line (e.g. -1.5)</label>
                                <input type="number" step="0.25" placeholder="Line" value={item.line || ''} onChange={(e) => handleDynamicOddsChange('handicaps', idx, 'line', e.target.value)} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                              </div>
                              <div className="w-1/3">
                                 <label className="text-xs block text-black" style={{ color: 'black' }}>Home Odds</label>
                                 <input type="number" step="0.01" placeholder="Home" value={item.homeOdds || ''} onChange={(e) => handleDynamicOddsChange('handicaps', idx, 'homeOdds', e.target.value)} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                              </div>
                              <div className="w-1/3">
                                 <label className="text-xs block text-black" style={{ color: 'black' }}>Away Odds</label>
                                 <input type="number" step="0.01" placeholder="Away" value={item.awayOdds || ''} onChange={(e) => handleDynamicOddsChange('handicaps', idx, 'awayOdds', e.target.value)} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                              </div>
                              <button type="button" onClick={() => removeDynamicOddItem('handicaps', idx)} className="text-red-500 font-bold px-2 self-end mb-1">X</button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Correct Score */}
                      <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                        <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>Correct Score</label>
                        <button type="button" onClick={() => addDynamicOddItem('correctScore', { score: '', odds: '' })} className="bg-green-600 text-white px-2 py-1 rounded text-xs mb-2">+ Add Score</button>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {(formData.odds.correctScore || []).map((item, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input type="text" placeholder="Score (1-0)" value={item.score || ''} onChange={(e) => handleDynamicOddsChange('correctScore', idx, 'score', e.target.value)} className="flex-1 bg-white text-black border border-gray-300 rounded p-1" />
                              <input type="number" step="0.01" placeholder="Odds" value={item.odds || ''} onChange={(e) => handleDynamicOddsChange('correctScore', idx, 'odds', e.target.value)} className="w-20 bg-white text-black border border-gray-300 rounded p-1" />
                              <button type="button" onClick={() => removeDynamicOddItem('correctScore', idx)} className="text-red-500 font-bold px-2">X</button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Goalscorers */}
                      <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                        <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>Goalscorer Markets</label>
                        <button type="button" onClick={() => addDynamicOddItem('goalScorers', { player: '', type: 'anytime', odds: '' })} className="bg-green-600 text-white px-2 py-1 rounded text-xs mb-2">+ Add Scorer</button>
                        <div className="space-y-2">
                          {(formData.odds.goalScorers || []).map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input type="text" placeholder="Player Name" value={item.player || ''} onChange={(e) => handleDynamicOddsChange('goalScorers', idx, 'player', e.target.value)} className="flex-1 bg-white text-black border border-gray-300 rounded p-1" />
                              <select value={item.type} onChange={(e) => handleDynamicOddsChange('goalScorers', idx, 'type', e.target.value)} className="bg-white text-black border border-gray-300 rounded p-1 w-24">
                                  <option value="first">First</option>
                                  <option value="anytime">Anytime</option>
                                  <option value="last">Last</option>
                              </select>
                              <input type="number" step="0.01" placeholder="Odds" value={item.odds || ''} onChange={(e) => handleDynamicOddsChange('goalScorers', idx, 'odds', e.target.value)} className="w-20 bg-white text-black border border-gray-300 rounded p-1" />
                              <button type="button" onClick={() => removeDynamicOddItem('goalScorers', idx)} className="text-red-500 font-bold px-2">X</button>
                            </div>
                          ))}
                        </div>
                      </div>

                       {/* HT/FT */}
                       <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                        <label className="font-bold block mb-2 text-black" style={{ color: 'black' }}>Half-Time/Full-Time (HT/FT)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['HH', 'HD', 'HA', 'DH', 'DD', 'DA', 'AH', 'AD', 'AA'].map(key => {
                              const labels = {
                                  'HH': 'Home/Home', 'HD': 'Home/Draw', 'HA': 'Home/Away',
                                  'DH': 'Draw/Home', 'DD': 'Draw/Draw', 'DA': 'Draw/Away',
                                  'AH': 'Away/Home', 'AD': 'Away/Draw', 'AA': 'Away/Away'
                              };
                              return (
                                  <div key={key}>
                                      <label className="text-xs block text-black" style={{ color: 'black' }}>{labels[key]}</label>
                                      <input type="number" step="0.01" name={`htFt${key}`} value={formData.odds[`htFt${key}`] || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                                  </div>
                              );
                          })}
                        </div>
                      </div>

                      {/* Multi Goals */}
                      <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                        <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>Multi Goals / Goal Bands</label>
                        <button type="button" onClick={() => addDynamicOddItem('multiGoals', { range: '', odds: '' })} className="bg-green-600 text-white px-2 py-1 rounded text-xs mb-2">+ Add Range</button>
                        <div className="space-y-2">
                          {(formData.odds.multiGoals || []).map((item, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input type="text" placeholder="Range (e.g. 2-3)" value={item.range || ''} onChange={(e) => handleDynamicOddsChange('multiGoals', idx, 'range', e.target.value)} className="flex-1 bg-white text-black border border-gray-300 rounded p-1" />
                              <input type="number" step="0.01" placeholder="Odds" value={item.odds || ''} onChange={(e) => handleDynamicOddsChange('multiGoals', idx, 'odds', e.target.value)} className="w-24 bg-white text-black border border-gray-300 rounded p-1" />
                              <button type="button" onClick={() => removeDynamicOddItem('multiGoals', idx)} className="text-red-500 font-bold px-2">X</button>
                            </div>
                          ))}
                        </div>
                      </div>

                       {/* Winning Margin */}
                       <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                        <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>Winning Margin</label>
                        <button type="button" onClick={() => addDynamicOddItem('winningMargin', { margin: '', odds: '' })} className="bg-green-600 text-white px-2 py-1 rounded text-xs mb-2">+ Add Margin</button>
                        <div className="space-y-2">
                          {(formData.odds.winningMargin || []).map((item, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input type="text" placeholder="Margin (e.g. Home by 1)" value={item.margin || ''} onChange={(e) => handleDynamicOddsChange('winningMargin', idx, 'margin', e.target.value)} className="flex-1 bg-white text-black border border-gray-300 rounded p-1" />
                              <input type="number" step="0.01" placeholder="Odds" value={item.odds || ''} onChange={(e) => handleDynamicOddsChange('winningMargin', idx, 'odds', e.target.value)} className="w-24 bg-white text-black border border-gray-300 rounded p-1" />
                              <button type="button" onClick={() => removeDynamicOddItem('winningMargin', idx)} className="text-red-500 font-bold px-2">X</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Corners & Cards Tab */}
                {activeOddsTab === 'corners_cards' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Corners */}
                    <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                      <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>Corners Over/Under</label>
                      <div className="space-y-2">
                        <input type="number" step="0.5" name="cornersLine" placeholder="Line (e.g. 9.5)" value={formData.odds.cornersLine || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        <input type="number" step="0.01" name="cornersOver" placeholder="Over Odds" value={formData.odds.cornersOver || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        <input type="number" step="0.01" name="cornersUnder" placeholder="Under Odds" value={formData.odds.cornersUnder || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                      </div>
                    </div>

                    {/* Cards */}
                    <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                      <label className="font-bold block mb-1 text-black" style={{ color: 'black' }}>Cards Over/Under</label>
                      <div className="space-y-2">
                        <input type="number" step="0.5" name="cardsLine" placeholder="Line (e.g. 3.5)" value={formData.odds.cardsLine || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        <input type="number" step="0.01" name="cardsOver" placeholder="Over Odds" value={formData.odds.cardsOver || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        <input type="number" step="0.01" name="cardsUnder" placeholder="Under Odds" value={formData.odds.cardsUnder || ''} onChange={handleOddsChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom Markets Tab */}
                {activeOddsTab === 'custom' && (
                  <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-black" style={{ color: 'black' }}>Custom Markets</h3>
                        <button type="button" onClick={addCustomMarket} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">+ New Market</button>
                     </div>
                     <p className="text-sm italic mb-2 text-gray-600">Create your own markets with custom options.</p>
                     
                     {(formData.odds.customMarkets || []).map((market, mIdx) => (
                       <div key={market.id || mIdx} className="bg-gray-100 p-4 rounded border border-gray-300">
                          <div className="flex justify-between items-center mb-2">
                             <input 
                                type="text" 
                                placeholder="Market Name (e.g. Method of Victory)" 
                                value={market.name || ''} 
                                onChange={(e) => updateCustomMarketName(mIdx, e.target.value)}
                                className="font-bold text-lg bg-white text-black border border-gray-300 rounded p-1 focus:outline-none w-1/2"
                             />
                             <div className="flex gap-2">
                                <button type="button" onClick={() => addCustomMarketOption(mIdx)} className="bg-green-600 text-white px-2 py-1 rounded text-xs">+ Add Option</button>
                                <button type="button" onClick={() => removeCustomMarket(mIdx)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">Remove Market</button>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                             {(market.options || []).map((opt, oIdx) => (
                                <div key={oIdx} className="flex gap-2 items-center bg-white p-2 rounded border border-gray-300">
                                   <input 
                                      type="text" 
                                      placeholder="Option Name" 
                                      value={opt.name || ''} 
                                      onChange={(e) => updateCustomMarketOption(mIdx, oIdx, 'name', e.target.value)}
                                      className="flex-1 bg-white text-black border border-gray-300 rounded p-1 text-sm"
                                   />
                                   <input 
                                      type="number" 
                                      step="0.01" 
                                      placeholder="Odds" 
                                      value={opt.odds || ''} 
                                      onChange={(e) => updateCustomMarketOption(mIdx, oIdx, 'odds', e.target.value)}
                                      className="w-20 bg-white text-black border border-gray-300 rounded p-1 text-sm"
                                   />
                                   <button type="button" onClick={() => removeCustomMarketOption(mIdx, oIdx)} className="text-red-500 font-bold px-2">X</button>
                                </div>
                             ))}
                          </div>
                       </div>
                     ))}
                  </div>
                )}

                {/* Settlement Results Tab */}
                {activeOddsTab === 'results' && (
                  <div className="space-y-4">
                    <p className="text-sm mb-2 text-gray-600">Enter the final results here for settlement purposes. These values will determine winning bets.</p>
                    
                    {/* Final Scores & Half Time Scores */}
                    <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                      <label className="font-bold block mb-2 text-black">Match Scores</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="text-xs block text-black">Home Score (FT)</label>
                          <input type="number" name="homeScore" value={formData.predeterminedResult?.homeScore || ''} onChange={handleResultChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                        <div>
                          <label className="text-xs block text-black">Away Score (FT)</label>
                          <input type="number" name="awayScore" value={formData.predeterminedResult?.awayScore || ''} onChange={handleResultChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                        <div>
                          <label className="text-xs block text-black">Home Score (HT)</label>
                          <input type="number" name="homeScoreHT" value={formData.predeterminedResult?.homeScoreHT || ''} onChange={handleResultChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                        <div>
                          <label className="text-xs block text-black">Away Score (HT)</label>
                          <input type="number" name="awayScoreHT" value={formData.predeterminedResult?.awayScoreHT || ''} onChange={handleResultChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                      </div>
                    </div>

                    {/* Corners & Cards & Penalty Results */}
                    <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                      <label className="font-bold block mb-2 text-black">Corners, Cards & Events</label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                          <label className="text-xs block text-black">Home Corners</label>
                          <input type="number" name="homeCorners" value={formData.predeterminedResult?.homeCorners || ''} onChange={handleResultChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                        <div>
                          <label className="text-xs block text-black">Away Corners</label>
                          <input type="number" name="awayCorners" value={formData.predeterminedResult?.awayCorners || ''} onChange={handleResultChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                        <div>
                          <label className="text-xs block text-black">Home Cards</label>
                          <input type="number" name="homeCards" value={formData.predeterminedResult?.homeCards || ''} onChange={handleResultChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                        <div>
                          <label className="text-xs block text-black">Away Cards</label>
                          <input type="number" name="awayCards" value={formData.predeterminedResult?.awayCards || ''} onChange={handleResultChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" />
                        </div>
                        <div className="flex items-center mt-4">
                          <input type="checkbox" name="penaltyAwarded" checked={formData.predeterminedResult?.penaltyAwarded || false} onChange={(e) => handleResultChange({ target: { name: 'penaltyAwarded', value: e.target.checked } })} className="mr-2" />
                          <label className="text-xs block text-black">Penalty Awarded?</label>
                        </div>
                      </div>
                    </div>

                    {/* Goalscorers Results */}
                    <div className="form-group p-2 bg-gray-100 border border-gray-300 rounded">
                      <label className="font-bold block mb-2 text-black">Goalscorer Results</label>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs block text-black">First Goalscorer (Name)</label>
                          <input type="text" name="firstGoalscorer" value={formData.predeterminedResult?.firstGoalscorer || ''} onChange={handleResultChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" placeholder="e.g. Lionel Messi" />
                        </div>
                        <div>
                          <label className="text-xs block text-black">Anytime Goalscorers (Comma separated)</label>
                          <input type="text" name="anytimeGoalscorers" value={formData.predeterminedResult?.anytimeGoalscorers || ''} onChange={handleResultChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" placeholder="e.g. Lionel Messi, Neymar, Mbappe" />
                        </div>
                        <div>
                          <label className="text-xs block text-black">Last Goalscorer (Name)</label>
                          <input type="text" name="lastGoalscorer" value={formData.predeterminedResult?.lastGoalscorer || ''} onChange={handleResultChange} className="w-full bg-white text-black border border-gray-300 rounded p-1" placeholder="e.g. Mbappe" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Match Scripting Section - Moved to Results Tab, keeping Scheduled Events */}
              <div className="border-t border-gray-300 pt-4 mt-4 mb-4">
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-bold text-black">Scheduled Events (Live Simulation)</label>
                    <button type="button" onClick={addScheduledEvent} className="bg-green-600 text-white px-2 py-1 rounded text-sm hover:bg-green-700">+ Add Event</button>
                  </div>
                  
                  {scheduledEvents.length === 0 && (
                     <p className="text-gray-500 text-sm italic">No scheduled events added.</p>
                  )}

                  {scheduledEvents.map((event, index) => (
                    <div key={index} className="flex gap-2 mb-2 items-center bg-gray-100 p-2 rounded border border-gray-300">
                      <div className="w-16">
                        <label className="text-xs block text-black">Min</label>
                        <input
                          type="number"
                          placeholder="Min"
                          value={event.minute}
                          onChange={(e) => updateScheduledEvent(index, 'minute', Number(e.target.value))}
                          className="w-full p-1 bg-white text-black rounded border border-gray-300"
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-xs block text-black">Type</label>
                        <select
                          value={event.type}
                          onChange={(e) => updateScheduledEvent(index, 'type', e.target.value)}
                          className="w-full p-1 bg-white text-black rounded border border-gray-300"
                        >
                          <option value="goal">Goal</option>
                          <option value="card">Card</option>
                        </select>
                      </div>
                      <div className="w-24">
                         <label className="text-xs block text-black">Team</label>
                        <select
                          value={event.team}
                          onChange={(e) => updateScheduledEvent(index, 'team', e.target.value)}
                          className="w-full p-1 bg-white text-black rounded border border-gray-300"
                        >
                          <option value="home">Home</option>
                          <option value="away">Away</option>
                        </select>
                      </div>
                      <div className="flex-1">
                         <label className="text-xs block text-black">Player/Desc</label>
                        <input
                          type="text"
                          placeholder="Player Name"
                          value={event.player}
                          onChange={(e) => updateScheduledEvent(index, 'player', e.target.value)}
                          className="w-full p-1 bg-white text-black rounded border border-gray-300"
                        />
                      </div>
                      <button type="button" onClick={() => removeScheduledEvent(index)} className="text-red-500 font-bold px-2 self-end mb-1">X</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-export"
                >
                  {currentMatch ? 'Update Match' : 'Add Match'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {isResultModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-lg">
              <h3 className="text-xl font-bold text-black">Update Match Result</h3>
              <button
                className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
                onClick={closeResultModal}
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form onSubmit={handleUpdateResult} className="space-y-4">
                <div className="text-sm mb-2 text-gray-700">
                  {currentMatch && (
                    <span>
                      {currentMatch.homeTeam} vs {currentMatch.awayTeam}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-100 p-4 rounded border border-gray-300">
                  <div className="form-group">
                    <label className="text-black block mb-1">Home Score:</label>
                    <input
                      type="number"
                      min="0"
                      value={resultHomeScore}
                      onChange={(e) => setResultHomeScore(e.target.value)}
                      required
                      className="w-full bg-white text-black border border-gray-300 rounded p-1"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-black block mb-1">Away Score:</label>
                    <input
                      type="number"
                      min="0"
                      value={resultAwayScore}
                      onChange={(e) => setResultAwayScore(e.target.value)}
                      required
                      className="w-full bg-white text-black border border-gray-300 rounded p-1"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-black block mb-1">Completed:</label>
                    <select
                      value={resultCompleted ? 'true' : 'false'}
                      onChange={(e) => setResultCompleted(e.target.value === 'true')}
                      className="w-full bg-white text-black border border-gray-300 rounded p-1"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>

                {/* Extended Results: Half Time */}
                <div className="border-t border-gray-300 pt-4 mt-4">
                  <h4 className="font-bold mb-2 text-black">Half Time Scores</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-100 p-4 rounded border border-gray-300">
                    <div className="form-group">
                      <label className="text-black block mb-1">HT Home Score:</label>
                      <input
                        type="number"
                        min="0"
                        value={resultHomeScoreHT}
                        onChange={(e) => setResultHomeScoreHT(e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-white text-black border border-gray-300 rounded p-1"
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-black block mb-1">HT Away Score:</label>
                      <input
                        type="number"
                        min="0"
                        value={resultAwayScoreHT}
                        onChange={(e) => setResultAwayScoreHT(e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-white text-black border border-gray-300 rounded p-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Extended Results: Stats */}
                <div className="border-t border-gray-300 pt-4 mt-4">
                  <h4 className="font-bold mb-2 text-black">Match Stats</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-100 p-4 rounded border border-gray-300">
                    <div className="form-group">
                      <label className="text-black block mb-1">Home Corners:</label>
                      <input
                        type="number"
                        min="0"
                        value={resultHomeCorners}
                        onChange={(e) => setResultHomeCorners(e.target.value)}
                        placeholder="Opt"
                        className="w-full bg-white text-black border border-gray-300 rounded p-1"
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-black block mb-1">Away Corners:</label>
                      <input
                        type="number"
                        min="0"
                        value={resultAwayCorners}
                        onChange={(e) => setResultAwayCorners(e.target.value)}
                        placeholder="Opt"
                        className="w-full bg-white text-black border border-gray-300 rounded p-1"
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-black block mb-1">Home Cards:</label>
                      <input
                        type="number"
                        min="0"
                        value={resultHomeCards}
                        onChange={(e) => setResultHomeCards(e.target.value)}
                        placeholder="Opt"
                        className="w-full bg-white text-black border border-gray-300 rounded p-1"
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-black block mb-1">Away Cards:</label>
                      <input
                        type="number"
                        min="0"
                        value={resultAwayCards}
                        onChange={(e) => setResultAwayCards(e.target.value)}
                        placeholder="Opt"
                        className="w-full bg-white text-black border border-gray-300 rounded p-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Extended Results: Events */}
                <div className="border-t border-gray-300 pt-4 mt-4">
                  <h4 className="font-bold mb-2 text-black">Key Events</h4>
                  <div className="bg-gray-100 p-4 rounded border border-gray-300">
                    <div className="mb-4">
                      <label className="flex items-center gap-2 text-black cursor-pointer">
                        <input
                          type="checkbox"
                          checked={resultPenaltyAwarded}
                          onChange={(e) => setResultPenaltyAwarded(e.target.checked)}
                          className="mr-2"
                        />
                        <span>Penalty Awarded?</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="form-group">
                        <label className="text-black block mb-1">First Goalscorer:</label>
                        <input
                          type="text"
                          value={resultFirstGoalscorer}
                          onChange={(e) => setResultFirstGoalscorer(e.target.value)}
                          placeholder="Player Name"
                          className="w-full bg-white text-black border border-gray-300 rounded p-1"
                        />
                      </div>
                      <div className="form-group">
                        <label className="text-black block mb-1">Last Goalscorer:</label>
                        <input
                          type="text"
                          value={resultLastGoalscorer}
                          onChange={(e) => setResultLastGoalscorer(e.target.value)}
                          placeholder="Player Name"
                          className="w-full bg-white text-black border border-gray-300 rounded p-1"
                        />
                      </div>
                      <div className="form-group">
                        <label className="text-black block mb-1">Anytime Scorers:</label>
                        <input
                          type="text"
                          value={resultAnytimeGoalscorers}
                          onChange={(e) => setResultAnytimeGoalscorers(e.target.value)}
                          placeholder="Comma separated"
                          className="w-full bg-white text-black border border-gray-300 rounded p-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button type="button" className="btn-cancel" onClick={closeResultModal}>Cancel</button>
                  <button type="submit" className="btn-export">Save Result</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageMatches;
