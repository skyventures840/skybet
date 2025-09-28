import React, { useState, useEffect } from 'react';
import api from '../services/api';

import { Container, Typography, CircularProgress, Alert, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Pagination, TextField } from '@mui/material';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

/**
 * @typedef {Object} Outcome
 * @property {string} name
 * @property {number} price
 * @property {number} [point]
 *
 * @typedef {Object} Market
 * @property {string} key
 * @property {string} last_update
 * @property {Outcome[]} outcomes
 *
 * @typedef {Object} Bookmaker
 * @property {string} key
 * @property {string} title
 * @property {string} last_update
 * @property {Market[]} markets
 *
 * @typedef {Object} OddsItem
 * @property {string} gameId
 * @property {string} sport_key
 * @property {string} sport_title
 * @property {string} commence_time
 * @property {string} home_team
 * @property {string} away_team
 * @property {Bookmaker[]} bookmakers
 * @property {string} lastFetched
 */

const OddsPage = () => {
  const [odds, setOdds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);


  useEffect(() => {
    const fetchOdds = async () => {
      setLoading(true);
      try {
        const params = {
          page,
          limit: 10,
          searchTerm,
          date: selectedDate ? selectedDate.format('YYYY-MM-DD') : '',
        };
        const response = await api.get('/odds', { params });
        setOdds(response.data.data);
        setTotalPages(response.data.totalPages);
      } catch (err) {
        console.error('Error fetching odds:', err);
        setError('Failed to fetch odds. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchOdds();
  }, [page, searchTerm, selectedDate]);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        All Upcoming Odds
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, justifyContent: 'center' }}>
        <TextField
          label="Search by Team Name"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ width: '300px' }}
        />
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="Filter by Date"
            value={selectedDate}
            onChange={(newValue) => setSelectedDate(newValue)}
            renderInput={(params) => <TextField {...params} sx={{ width: '200px' }} />}
          />
        </LocalizationProvider>
      </Box>
      {odds.length === 0 ? (
        <Typography variant="h6" align="center" sx={{ mt: 4 }}>
          No odds available at the moment. Please check back later.
        </Typography>
      ) : (
        <TableContainer component={Paper} elevation={3}>
          <Table sx={{ minWidth: 650 }} aria-label="odds table">
            <TableHead>
              <TableRow>
                <TableCell>Sport</TableCell>
                <TableCell>Matchup</TableCell>
                <TableCell>Commence Time</TableCell>
                <TableCell>Bookmaker</TableCell>
                <TableCell align="right">Home Team Odds</TableCell>
                <TableCell align="right">Away Team Odds</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {odds.map((game) => (
                game.bookmakers.map((bookmaker) => {
                  // Check if bookmaker has valid markets
                  const h2hMarket = bookmaker.markets?.find(market => market.key === 'h2h');
                  if (!h2hMarket || !h2hMarket.outcomes || h2hMarket.outcomes.length < 2) {
                    return null; // Skip bookmakers with invalid markets
                  }

                  const homeOdds = h2hMarket.outcomes.find(o => o.name === game.home_team)?.price;
                  const awayOdds = h2hMarket.outcomes.find(o => o.name === game.away_team)?.price;

                  // Only show row if we have valid odds
                  if (!homeOdds || !awayOdds) {
                    return null;
                  }

                  return (
                    <TableRow
                      key={`${game.gameId}-${bookmaker.key}`}
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        {game.sport_title}
                      </TableCell>
                      <TableCell>{game.home_team} vs {game.away_team}</TableCell>
                      <TableCell>{new Date(game.commence_time).toLocaleString()}</TableCell>
                      <TableCell>{bookmaker.title}</TableCell>
                      <TableCell align="right">
                        {homeOdds}
                      </TableCell>
                      <TableCell align="right">
                        {awayOdds}
                      </TableCell>
                    </TableRow>
                  );
                }).filter(row => row !== null) // Remove null rows
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination count={totalPages} page={page} onChange={handlePageChange} color="primary" />
        </Box>
      )}
    </Container>
  );
};

export default OddsPage;