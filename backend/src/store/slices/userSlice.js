import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  username: null,
  email: null,
  profile: null,
  balance: 0,
  loading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.username = action.payload.username;
      state.email = action.payload.email;
      state.profile = action.payload.profile;
      state.balance = action.payload.balance || 0;
    },
    updateUser: (state, action) => {
      Object.assign(state, action.payload);
    },
    updateBalance: (state, action) => {
      state.balance = action.payload;
    },
    clearUser: (state) => {
      state.username = null;
      state.email = null;
      state.profile = null;
      state.balance = 0;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const { setUser, updateUser, updateBalance, clearUser, setLoading, setError } = userSlice.actions;
export default userSlice.reducer;