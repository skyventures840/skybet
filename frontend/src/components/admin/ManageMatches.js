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

  useEffect(() => {
    fetchMatches();
    fetchLeagues();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAllMatches();
      setMatches(response.data.matches);
    } catch (err) {
      setError('Failed to fetch matches.');
      console.error(err);
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
        videoPosterUrl: formData.videoPosterUrl || undefined
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
      videoPosterUrl: ''
    });
    setShowAddLeague(false);
    setNewLeagueName('');
    setIsModalOpen(true);
  };

  const openEditModal = (match) => {
    setCurrentMatch(match);
    setFormData({
      leagueName: leagues.find(l => l.leagueId === match.leagueId)?.name || '',
      sport: match.sport,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      startTime: match.startTime.slice(0, 16),
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      odds: match.odds || {},
      videoUrl: match.videoUrl || '',
      videoPosterUrl: match.videoPosterUrl || ''
    });
    setShowAddLeague(false);
    setNewLeagueName('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentMatch(null);
  };

  // Search/filter logic
  const handleSearch = (e) => {
    e.preventDefault();
    setSearchPerformed(true);
    if (!searchQuery.trim() && !statusFilter) {
      setFilteredMatches([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    setFilteredMatches(
      matches.filter((match) => {
        const league = leagues.find(l => l.leagueId === match.leagueId)?.name || match.leagueName || "";
        
        const matchesSearch = !query || (
          match.homeTeam?.toLowerCase().includes(query) ||
          match.awayTeam?.toLowerCase().includes(query) ||
          league.toLowerCase().includes(query)
        );

        const matchesStatus = !statusFilter || match.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
    );
  };

  // Add clear search function
  const handleClearSearch = () => {
    setSearchQuery('');
    setStatusFilter('');
    setSearchPerformed(false);
    setFilteredMatches([]);
  };

  // Add show all matches function
  const handleShowAll = () => {
    setSearchQuery('');
    setSearchPerformed(true);
    setFilteredMatches(matches);
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

  if (loading) return <div className="text-white">Loading matches...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

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
        <div className="search-filter">
          <input
            type="text"
            placeholder="Search by team or league..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
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
          <table className="admin-table">
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
                      <div className="teams">{match.homeTeam} vs {match.awayTeam}</div>
                    </div>
                  </td>
                  <td>
                    <div className="league">{match.leagueId?.name || 'N/A'}</div>
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
                    {match.homeScore !== null ? `${match.homeScore} - ${match.awayScore}` : 'N/A'}
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
                    <div className="action-buttons">
                      <button
                        onClick={() => openEditModal(match)}
                        className="btn-edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteMatch(match._id)}
                        className="btn-cancel"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedMatches.length > 0 && (
        <div className="bulk-actions">
          <div className="flex items-center justify-between">
            <span className="text-white">
              {selectedMatches.length} match(es) selected
            </span>
            <div className="flex items-center gap-3">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
              >
                <option value="">Select Action</option>
                <option value="status-upcoming">Set Status: Upcoming</option>
                <option value="status-live">Set Status: Live</option>
                <option value="status-finished">Set Status: Finished</option>
                <option value="status-cancelled">Set Status: Cancelled</option>
                <option value="delete">Delete Matches</option>
              </select>
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction}
                className="btn-export disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Action
              </button>
              <button
                onClick={() => {
                  setSelectedMatches([]);
                  setAllMatchesSelected(false);
                  setBulkAction('');
                }}
                className="btn-cancel"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{currentMatch ? 'Edit Match' : 'Add New Match'}</h3>
              <button 
                className="modal-close"
                onClick={closeModal}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
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
                      {leagues.map(l => (
                        <option key={l._id} value={l.name}>{l.name}</option>
                      ))}
                      <option value="__add_new__">+ Add New League</option>
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
    </div>
  );
};

export default ManageMatches;