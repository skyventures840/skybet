import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';

const ManageMatches = () => {
  const [matches, setMatches] = useState([]);
  const [leagues, setLeagues] = useState([]);
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
  const [scheduledEvents, setScheduledEvents] = useState([]);
  const [openActionId, setOpenActionId] = useState(null);

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
  }, []);

  // Infer a normalized sport token from odds data
  // Prefers `sport_key` first token; otherwise derives from `sport_title`
  const inferSportToken = (odds) => {
    const rawKey = String(odds?.sport_key || '').toLowerCase();
    if (rawKey) {
      const token = rawKey.split('_')[0];
      if (token) return token;
    }

    const title = String(odds?.sport_title || '').toLowerCase();
    if (!title) return 'unknown';

    const mappings = [
      { re: /(mma|mixed\s*martial\s*arts)/i, token: 'mma' },
      { re: /boxing/i, token: 'boxing' },
      { re: /(american\s*football|\bnfl\b|\bncaaf\b|college\s*football|\bcfl\b)/i, token: 'americanfootball' },
      { re: /basketball|\bnba\b|euroleague/i, token: 'basketball' },
      { re: /baseball|\bmlb\b/i, token: 'baseball' },
      { re: /(ice\s*hockey|\bnhl\b|\bkhl\b|\bahl\b|\bshl\b|\bliiga\b|\bdel\b|\bnla\b)/i, token: 'icehockey' },
      { re: /tennis|\batp\b|\bwta\b|wimbledon|us\s*open|french\s*open|roland\s*garros/i, token: 'tennis' },
      { re: /volleyball/i, token: 'volleyball' },
      { re: /cricket/i, token: 'cricket' },
      { re: /(soccer\b|football(?!.*american))/i, token: 'soccer' }
    ];

    for (const m of mappings) {
      if (m.re.test(title)) return m.token;
    }
    return 'unknown';
  };

  const fetchMatches = async () => {
    try {
      setLoading(true);
      // Fetch from odds collection for admin management
      const response = await apiService.getOddsMatches();
      const oddsMatches = response.data?.matches || [];
      // Normalize odds format to the admin UI shape
      const normalized = oddsMatches.map(odds => {
        try {
          return {
            _id: odds.id || odds.gameId,
            externalId: odds.id || odds.gameId,
            sport: inferSportToken(odds),
            sportTitle: odds.sport_title || '',
            homeTeam: odds.home_team,
            awayTeam: odds.away_team,
            startTime: odds.commence_time,
            status: 'upcoming',
            // initialize score fields explicitly to avoid undefined in UI
            homeScore: null,
            awayScore: null,
            odds: odds.bookmakers || {},
          };
        } catch (e) {
          console.error('Error normalizing match:', odds, e);
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
        startTime: formData.startTime || new Date().toISOString(),
        odds: formData.odds && Object.keys(formData.odds).length > 0 ? formData.odds : {},
        sport: (formData.sport || 'football').toLowerCase(),
        status: formData.status || 'upcoming',
        homeScore: formData.homeScore || 0,
        awayScore: formData.awayScore || 0,
        videoUrl: formData.videoUrl || undefined,
        videoPosterUrl: formData.videoPosterUrl || undefined,
        predeterminedResult: {
          homeScore: formData.predeterminedHomeScore !== '' ? Number(formData.predeterminedHomeScore) : null,
          awayScore: formData.predeterminedAwayScore !== '' ? Number(formData.predeterminedAwayScore) : null,
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
      odds: {},
      videoUrl: '',
      videoPosterUrl: '',
      predeterminedHomeScore: '',
      predeterminedAwayScore: ''
    });
    setScheduledEvents([]);
    setShowAddLeague(false);
    setNewLeagueName('');
    setIsModalOpen(true);
  };

  const openEditModal = (match) => {
    setCurrentMatch(match);
    setScheduledEvents(match.scheduledEvents || []);
    setFormData({
      leagueName: leagues.find(l => l.leagueId === match.leagueId)?.name || match.leagueId?.name || '', // Handle populated league
      sport: match.sport,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      startTime: match.startTime.slice(0, 16),
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      odds: match.odds || {},
      videoUrl: match.videoUrl || '',
      videoPosterUrl: match.videoPosterUrl || '',
      predeterminedHomeScore: match.predeterminedResult?.homeScore ?? '',
      predeterminedAwayScore: match.predeterminedResult?.awayScore ?? ''
    });
    setShowAddLeague(false);
    setNewLeagueName('');
    setIsModalOpen(true);
  };

  const openResultModal = (match) => {
    setCurrentMatch(match);
    setResultHomeScore(Number(match.homeScore ?? 0));
    setResultAwayScore(Number(match.awayScore ?? 0));
    setResultCompleted(true);
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
        completed: Boolean(resultCompleted)
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
                              Update Result
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
                      <div className="text-gray-400 text-xs">Score</div>
                      <div className="text-white font-mono">
                        {match.homeScore != null && match.awayScore != null ? `${match.homeScore} - ${match.awayScore}` : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-gray-700 p-2 rounded">
                      <div className="text-gray-400 text-xs">Odds</div>
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
                        Update Result
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
              <h3 className="text-xl font-bold text-gray-800">{currentMatch ? 'Edit Match' : 'Add New Match'}</h3>
              <button 
                className="modal-close text-gray-500 hover:text-gray-700 text-2xl font-bold"
                onClick={closeModal}
              >
                ×
              </button>
            </div>
            <div className="modal-body p-6 overflow-y-auto custom-scrollbar">
            {saveMessage && (
              <div className="mb-4 text-green-400 text-sm">{saveMessage}</div>
            )}
            <form onSubmit={handleCreateOrUpdateMatch} className="space-y-4">
              <div className="form-group">
                <label style={{ color: 'black' }}>League:</label>
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
                      required
                    >
                      <option value="">Select League</option>
                      <option value="__add_new__" className="font-bold text-cyan-400">+ Add New League</option>
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
                      required
                    />
                    <button
                      type="button"
                      className="btn-cancel"
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
                <label style={{ color: 'black' }}>Match Video (MP4/WebM)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Video URL:</label>
                    <input
                      type="url"
                      name="videoUrl"
                      placeholder="https://your-backend-url.onrender.com/uploads/videos/your-video.mp4"
                      value={formData.videoUrl}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-white text-sm font-bold mb-2">Or upload video file:</label>
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
                        className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-700"
                      />
                      <div className="text-xs text-gray-400 mt-1">You can upload before or after saving; the URL is stored with the match.</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Poster URL */}
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white text-sm font-bold mb-2">Poster URL (thumbnail):</label>
                    <input
                      type="url"
                      name="videoPosterUrl"
                      placeholder="https://your-backend-url.onrender.com/uploads/posters/poster.jpg"
                      value={formData.videoPosterUrl}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-black"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-white text-sm font-bold mb-2">Or upload poster image:</label>
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
                        className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-700"
                      />
                      <div className="text-xs text-gray-400 mt-1">You can upload before or after saving; the URL is stored with the match.</div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-white text-sm font-bold mb-2">League ID (auto):</label>
                <input
                  type="text"
                  value={autoLeagueId}
                  readOnly
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-black"
                />
              </div>
              <div>
                <label className="block text-white text-sm font-bold mb-2">External ID (auto):</label>
                <input
                  type="text"
                  value={autoExternalId}
                  readOnly
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-black leading-tight focus:outline-none focus:shadow-outline bg-white border-black"
                />
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Sport:</label>
                <input
                  type="text"
                  name="sport"
                  value={formData.sport}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Home Team:</label>
                <input
                  type="text"
                  name="homeTeam"
                  value={formData.homeTeam}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Away Team:</label>
                <input
                  type="text"
                  name="awayTeam"
                  value={formData.awayTeam}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Start Time:</label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Status:</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="finished">Finished</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="postponed">Postponed</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Home Score:</label>
                <input
                  type="number"
                  name="homeScore"
                  value={formData.homeScore || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label style={{ color: 'black' }}>Away Score:</label>
                <input
                  type="number"
                  name="awayScore"
                  value={formData.awayScore || ''}
                  onChange={handleInputChange}
                />
              </div>
              {/* Odds Inputs */}
              <div className="form-group">
                <label style={{ color: 'black' }}>Odds (Optional)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Home Win:</label>
                    <input
                      type="number"
                      step="0.01"
                      name="homeWin"
                      value={formData.odds.homeWin || ''}
                      onChange={handleOddsChange}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Draw:</label>
                    <input
                      type="number"
                      step="0.01"
                      name="draw"
                      value={formData.odds.draw || ''}
                      onChange={handleOddsChange}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Away Win:</label>
                    <input
                      type="number"
                      step="0.01"
                      name="awayWin"
                      value={formData.odds.awayWin || ''}
                      onChange={handleOddsChange}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Total (Over/Under Line):</label>
                    <input
                      type="number"
                      step="0.01"
                      name="total"
                      value={formData.odds.total || ''}
                      onChange={handleOddsChange}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Over Odds:</label>
                    <input
                      type="number"
                      step="0.01"
                      name="over"
                      value={formData.odds.over || ''}
                      onChange={handleOddsChange}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Under Odds:</label>
                    <input
                      type="number"
                      step="0.01"
                      name="under"
                      value={formData.odds.under || ''}
                      onChange={handleOddsChange}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Handicap Line:</label>
                    <input
                      type="number"
                      step="0.01"
                      name="handicapLine"
                      value={formData.odds.handicapLine || ''}
                      onChange={handleOddsChange}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Home Handicap Odds:</label>
                    <input
                      type="number"
                      step="0.01"
                      name="homeHandicap"
                      value={formData.odds.homeHandicap || ''}
                      onChange={handleOddsChange}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Away Handicap Odds:</label>
                    <input
                      type="number"
                      step="0.01"
                      name="awayHandicap"
                      value={formData.odds.awayHandicap || ''}
                      onChange={handleOddsChange}
                    />
                  </div>
                </div>
              </div>

              {/* Match Scripting Section */}
              <div className="border-t border-gray-600 pt-4 mt-4 mb-4">
                <h4 className="text-black text-lg font-bold mb-4">Match Scripting (Predetermined Results)</h4>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Final Home Score (Predetermined)</label>
                    <input
                      type="number"
                      name="predeterminedHomeScore"
                      value={formData.predeterminedHomeScore}
                      onChange={handleInputChange}
                      placeholder="Leave empty for fair play"
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Final Away Score (Predetermined)</label>
                    <input
                      type="number"
                      name="predeterminedAwayScore"
                      value={formData.predeterminedAwayScore}
                      onChange={handleInputChange}
                      placeholder="Leave empty for fair play"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-black text-sm font-bold">Scheduled Events (Goals)</label>
                    <button type="button" onClick={addScheduledEvent} className="bg-green-600 text-white px-2 py-1 rounded text-sm hover:bg-green-700">+ Add Event</button>
                  </div>
                  
                  {scheduledEvents.length === 0 && (
                     <p className="text-gray-500 text-sm italic">No scheduled events added.</p>
                  )}

                  {scheduledEvents.map((event, index) => (
                    <div key={index} className="flex gap-2 mb-2 items-center bg-gray-100 p-2 rounded border border-gray-300">
                      <div className="w-16">
                        <label className="text-xs text-black block">Min</label>
                        <input
                          type="number"
                          placeholder="Min"
                          value={event.minute}
                          onChange={(e) => updateScheduledEvent(index, 'minute', Number(e.target.value))}
                          className="w-full p-1 text-black rounded border border-gray-400"
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-xs text-black block">Type</label>
                        <select
                          value={event.type}
                          onChange={(e) => updateScheduledEvent(index, 'type', e.target.value)}
                          className="w-full p-1 text-black rounded border border-gray-400"
                        >
                          <option value="goal">Goal</option>
                          <option value="card">Card</option>
                        </select>
                      </div>
                      <div className="w-24">
                         <label className="text-xs text-black block">Team</label>
                        <select
                          value={event.team}
                          onChange={(e) => updateScheduledEvent(index, 'team', e.target.value)}
                          className="w-full p-1 text-black rounded border border-gray-400"
                        >
                          <option value="home">Home</option>
                          <option value="away">Away</option>
                        </select>
                      </div>
                      <div className="flex-1">
                         <label className="text-xs text-black block">Player/Desc</label>
                        <input
                          type="text"
                          placeholder="Player Name"
                          value={event.player}
                          onChange={(e) => updateScheduledEvent(index, 'player', e.target.value)}
                          className="w-full p-1 text-black rounded border border-gray-400"
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
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Update Match Result</h3>
              <button
                className="modal-close"
                onClick={closeResultModal}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpdateResult} className="space-y-4">
                <div className="text-white text-sm mb-2">
                  {currentMatch && (
                    <span>
                      {currentMatch.homeTeam} vs {currentMatch.awayTeam}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Home Score:</label>
                    <input
                      type="number"
                      min="0"
                      value={resultHomeScore}
                      onChange={(e) => setResultHomeScore(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Away Score:</label>
                    <input
                      type="number"
                      min="0"
                      value={resultAwayScore}
                      onChange={(e) => setResultAwayScore(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'black' }}>Completed:</label>
                    <select
                      value={resultCompleted ? 'true' : 'false'}
                      onChange={(e) => setResultCompleted(e.target.value === 'true')}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
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