import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  loggedIn: false,
  user: null, // Add user object to store user data
  token: null,
  loading: false,
  error: null,
  isAdmin: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.loading = false;
      state.loggedIn = true;
      state.token = action.payload.token;
      state.user = action.payload.user; // Store the entire user object
      state.isAdmin = action.payload.user.isAdmin;
      state.error = null;
    },
    loginFailure: (state, action) => {
      state.loading = false;
      state.loggedIn = false;
      state.token = null;
      state.error = action.payload;
    },
    logout: (state) => {
      state.loggedIn = false;
      state.user = null;
      state.token = null;
      state.error = null;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout, clearError, setUser } = authSlice.actions;
export default authSlice.reducer;