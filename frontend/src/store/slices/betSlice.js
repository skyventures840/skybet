import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  bets: [],
  loading: false,
  error: null
};

const betSlice = createSlice({
  name: 'bets',
  initialState,
  reducers: {
    setBets: (state, action) => {
      state.bets = action.payload;
    },
    addBet: (state, action) => {
      state.bets.push(action.payload);
    },
    removeBet: (state, action) => {
      state.bets = state.bets.filter(bet => bet.id !== action.payload);
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    }
  }
});

export const { setBets, addBet, removeBet, setLoading, setError } = betSlice.actions;
export default betSlice.reducer;