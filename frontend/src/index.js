
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/main.css';
import './styles/overrides.css';
import App from './App';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';

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

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Router>
          <App />
        </Router>
      </PersistGate>
    </Provider>
  </React.StrictMode>
);