import { createSlice, createSelector } from '@reduxjs/toolkit';

const initialState = {
  bets: [],
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  },
  filters: {
    status: 'all',
    sport: 'all'
  }
};

const betSlice = createSlice({
  name: 'bets',
  initialState,
  reducers: {
    setBets: (state, action) => {
      state.bets = action.payload.bets || action.payload;
      if (action.payload.pagination) {
        state.pagination = action.payload.pagination;
      }
    },
    addBet: (state, action) => {
      state.bets.unshift(action.payload); // Add to beginning for newest first
      state.pagination.total += 1;
    },
    updateBet: (state, action) => {
      const index = state.bets.findIndex(bet => bet._id === action.payload._id);
      if (index !== -1) {
        state.bets[index] = action.payload;
      }
    },
    removeBet: (state, action) => {
      state.bets = state.bets.filter(bet => bet._id !== action.payload);
      state.pagination.total = Math.max(0, state.pagination.total - 1);
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    resetBets: (state) => {
      state.bets = [];
      state.pagination = initialState.pagination;
      state.error = null;
    }
  }
});

// Memoized selectors for better performance
export const selectBets = (state) => state.bets.bets;
export const selectBetsLoading = (state) => state.bets.loading;
export const selectBetsError = (state) => state.bets.error;
export const selectBetsPagination = (state) => state.bets.pagination;
export const selectBetsFilters = (state) => state.bets.filters;

// Memoized filtered bets selector
export const selectFilteredBets = createSelector(
  [selectBets, selectBetsFilters],
  (bets, filters) => {
    return bets.filter(bet => {
      if (filters.status !== 'all' && bet.status !== filters.status) {
        return false;
      }
      if (filters.sport !== 'all' && bet.sport !== filters.sport) {
        return false;
      }
      return true;
    });
  }
);

// Memoized bet statistics selector
export const selectBetStats = createSelector(
  [selectBets],
  (bets) => {
    const stats = {
      total: bets.length,
      pending: 0,
      won: 0,
      lost: 0,
      totalStake: 0,
      totalWinnings: 0
    };

    bets.forEach(bet => {
      stats.totalStake += bet.stake || 0;
      switch (bet.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'won':
          stats.won++;
          stats.totalWinnings += bet.actualWin || 0;
          break;
        case 'lost':
          stats.lost++;
          break;
      }
    });

    return stats;
  }
);

export const { 
  setBets, 
  addBet, 
  updateBet, 
  removeBet, 
  setPagination, 
  setFilters, 
  setLoading, 
  setError, 
  clearError, 
  resetBets 
} = betSlice.actions;

export default betSlice.reducer;