import { configureStore } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Slices
import userReducer from './slices/userSlice';
import authReducer from './slices/authSlice';
import betsReducer from './slices/betSlice';
import activeBetsReducer from './slices/activeBetSlice';

const authPersistConfig = {
  key: 'auth',
  storage,
  whitelist: ['loggedIn', 'user', 'token', 'isAdmin'], // Only persist essential auth data
};

const userPersistConfig = {
  key: 'user',
  storage,
  whitelist: ['profile', 'preferences'], // Only persist essential user data
};

const persistAuthReducer = persistReducer(authPersistConfig, authReducer);
const persistUserReducer = persistReducer(userPersistConfig, userReducer);

export const store = configureStore({
  reducer: {
    user: persistUserReducer,
    auth: persistAuthReducer,
    bets: betsReducer,
    activeBets: activeBetsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST', 
          'persist/REHYDRATE',
          'persist/REGISTER',
          'persist/PURGE',
          'persist/FLUSH',
          'persist/PAUSE',
          'persist/RESUME'
        ],
        ignoredPaths: ['register', 'rehydrate'],
      },
      immutableCheck: {
        // Disable for better performance in production
        warnAfter: process.env.NODE_ENV === 'development' ? 32 : 128,
      },
    }),
  devTools: process.env.NODE_ENV === 'development',
});

export const persistor = persistStore(store);