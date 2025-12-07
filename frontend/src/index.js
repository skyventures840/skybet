
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/main.css';
import './styles/overrides.css';
import App from './App';
import apiService from './services/api';
import translator from './services/translator';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Development-only: ensure no stale service workers or caches interfere
if (process.env.NODE_ENV !== 'production') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => {
        registrations.forEach(reg => reg.unregister());
      })
      .catch(() => {});
  }
  if (window.caches) {
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .catch(() => {});
  }
  try {
    // Clear persisted Redux store and any filter-related localStorage
    persistor.purge();
    localStorage.removeItem('globalSearchTerm');
    localStorage.removeItem('globalSelectedDate');
  } catch (e) {
    // swallow
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
import { BrowserRouter as Router } from 'react-router-dom';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 45000,
      gcTime: 480000,
      retry: false,
      refetchOnWindowFocus: false
    }
  }
});

// Prewarm live matches cache to enable instant rendering on first visit
try {
  apiService.getLiveMatches().catch(err => { void err; });
} catch (e) { void e; }

try {
  apiService.getMatches().catch(err => { void err; });
} catch (e) { void e; }

try {
  apiService.getPopularMatches().catch(err => { void err; });
} catch (e) { void e; }

try {
  apiService.getHeroSlides().catch(err => { void err; });
} catch (e) { void e; }

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <QueryClientProvider client={queryClient}>
          <Router>
            <App />
          </Router>
        </QueryClientProvider>
      </PersistGate>
    </Provider>
  </React.StrictMode>
);

try { translator.initPageTranslator(); } catch (e) { void e; }
