import React, { useState, useEffect } from 'react';
import MatchCard from '../components/MatchCard';
import apiService from '../services/api';

const Hockey = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHockeyMatches = async () => {
      try {
        setLoading(true);
        // Use icehockey key instead of hockey to match the Odds API format
        const response = await apiService.getMatchesByKey('icehockey');
        console.log('Hockey matches response:', response.data);
        setMatches(response.data.matches);
      } catch (err) {
        console.error('Error fetching hockey matches:', err);
        setError('Failed to load matches');
      } finally {
        setLoading(false);
      }
    };

    fetchHockeyMatches();
  }, []);

  if (loading) return <div className="loading">Loading matches...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="sport-page">
      <div className="sport-header">
        <h1 className="sport-title">Field Hockey</h1>
        <p className="sport-subtitle">Bet on field hockey leagues and tournaments</p>
      </div>

      <div className="matches-section">
        <div className="section-header">
          <h2 className="section-title">UPCOMING MATCHES</h2>
          <button className="view-all-btn">View All</button>
        </div>

        <div className="matches-grid">
          {matches.map(match => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Hockey;