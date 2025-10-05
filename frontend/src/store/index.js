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
};

const userPersistConfig = {
  key: 'user',
  storage,
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
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export const persistor = persistStore(store);