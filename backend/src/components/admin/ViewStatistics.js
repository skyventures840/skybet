import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';

const ViewStatistics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAdminStatistics();
      setStats(response.data);
    } catch (err) {
      setError('Failed to fetch statistics.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-white">Loading statistics...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-bold mb-6 text-white">Platform Statistics</h2>
      {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gray-700 p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Total Users</h3>
            <p className="text-gray-300 text-2xl">{stats.totalUsers}</p>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Total Matches</h3>
            <p className="text-gray-300 text-2xl">{stats.totalMatches}</p>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Active Bets</h3>
            <p className="text-gray-300 text-2xl">{stats.activeBets}</p>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Total Revenue (Example)</h3>
            <p className="text-gray-300 text-2xl">${stats.totalRevenue ? stats.totalRevenue.toFixed(2) : '0.00'}</p>
          </div>
          {/* Add more statistics as needed */}
        </div>
      ) : (
        <p className="text-gray-300">No statistics available.</p>
      )}
    </div>
  );
};

export default ViewStatistics;