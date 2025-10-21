import { createSlice } from '@reduxjs/toolkit';

const initialState = [];

const activeBetSlice = createSlice({
  name: 'activeBets',
  initialState,
  reducers: {
    addBet: (state, action) => {
      const newBet = action.payload;
      const existingMatchBetIndex = state.findIndex(
        (bet) => bet.match === newBet.match
      );

      if (existingMatchBetIndex >= 0) {
        // If a bet for the same match exists, replace it
        state[existingMatchBetIndex] = newBet;
      } else {
        // Otherwise, add the new bet
        state.push(newBet);
      }
    },
    removeBet: (state, action) => {
      return state.filter((_, index) => index !== action.payload);
    },
    updateStake: (state, action) => {
      const { index, stake } = action.payload;
      if (state[index]) {
        state[index].stake = stake;
      }
    },
    clearBets: () => {
      return [];
    },
  },
});

export const { addBet, removeBet, updateStake, clearBets } = activeBetSlice.actions;
export default activeBetSlice.reducer;