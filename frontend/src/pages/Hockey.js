import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MatchCard from '../components/MatchCard';
import SkeletonLoader from '../components/SkeletonLoader';
import apiService from '../services/api';
import enhancedCache from '../services/enhancedCache';

const Hockey = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHockeyMatches = async () => {
      try {
        const response = await apiService.getMatchesByKey('icehockey');
        setMatches(response.data.matches);
      } catch (err) {
        console.error('Error fetching hockey matches:', err);
        setError('Failed to load matches');
      } finally {
        setLoading(false);
      }
    };

    // Instant restore from durable cache for instant display
    try {
      const cached = enhancedCache.getCachedData('/matches/sport/icehockey');
      if (cached && Array.isArray(cached.matches) && cached.matches.length > 0) {
        setMatches(cached.matches);
        setLoading(false);
      } else {
        setLoading(enhancedCache.shouldShowSkeleton());
      }
    } catch (e) {
      setLoading(enhancedCache.shouldShowSkeleton());
    }

    fetchHockeyMatches();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      if (loading) {
        navigate('/');
      }
    }, 30000);
    return () => clearTimeout(t);
  }, [loading, navigate]);

  if (loading) return <SkeletonLoader type="match-card" count={6} />;
  if (error && matches.length === 0) return <SkeletonLoader type="match-card" count={6} />;

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
