import React from 'react';

const sports = [
  { key: 'Soccer', name: 'Soccer', icon: (
    <svg viewBox="0 0 48 48" width="42" height="42" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#ffffff" stroke="#222" strokeWidth="2" />
      <polygon points="24,12 18,18 20,26 28,26 30,18" fill="#3b3b3b" />
      <polygon points="12,24 18,18 14,12 8,14 6,20" fill="#3b3b3b" />
      <polygon points="36,24 30,18 34,12 40,14 42,20" fill="#3b3b3b" />
      <polygon points="20,36 18,28 10,28 12,34 16,36" fill="#3b3b3b" />
      <polygon points="28,36 30,28 38,28 36,34 32,36" fill="#3b3b3b" />
    </svg>
  )},
  { key: 'Hockey', name: 'Hockey', icon: (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <rect x="8" y="30" width="32" height="6" rx="3" fill="#607d8b" />
      <rect x="26" y="12" width="4" height="18" fill="#8d6e63" />
      <rect x="16" y="20" width="4" height="10" fill="#8d6e63" />
    </svg>
  )},
  { key: 'Tennis', name: 'Tennis', icon: (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="#8bc34a" />
      <path d="M10 20c8 0 12 8 28 8" stroke="#fff" strokeWidth="3" fill="none" />
      <path d="M14 28c8 0 12-8 24-8" stroke="#fff" strokeWidth="3" fill="none" />
    </svg>
  )},
  { key: 'Basketball', name: 'Basketball', icon: (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="#f57c00" />
      <path d="M24 6v36" stroke="#5d4037" strokeWidth="3" />
      <path d="M6 24h36" stroke="#5d4037" strokeWidth="3" />
      <path d="M12 12c8 8 8 16 0 24" stroke="#5d4037" strokeWidth="3" fill="none" />
      <path d="M36 12c-8 8-8 16 0 24" stroke="#5d4037" strokeWidth="3" fill="none" />
    </svg>
  )},
  { key: 'Baseball', name: 'Baseball', icon: (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="#ffffff" stroke="#bdbdbd" strokeWidth="2" />
      <path d="M12 16c4 4 4 12 0 16" stroke="#d32f2f" strokeWidth="2" fill="none" />
      <path d="M36 16c-4 4-4 12 0 16" stroke="#d32f2f" strokeWidth="2" fill="none" />
    </svg>
  )},
  { key: 'American Football', name: 'Football (US)', icon: (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <ellipse cx="24" cy="24" rx="18" ry="12" fill="#6d4c41" />
      <path d="M14 24h20" stroke="#fff" strokeWidth="3" />
      <path d="M18 20v8M22 20v8M26 20v8M30 20v8" stroke="#fff" strokeWidth="2" />
    </svg>
  )},
  { key: 'Cricket', name: 'Cricket', icon: (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <circle cx="16" cy="24" r="8" fill="#c62828" />
      <rect x="26" y="12" width="4" height="20" fill="#a1887f" />
      <rect x="32" y="12" width="4" height="20" fill="#a1887f" />
    </svg>
  )},
  { key: 'Rugby', name: 'Rugby', icon: (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <ellipse cx="24" cy="24" rx="18" ry="12" fill="#8e24aa" />
      <path d="M10 20c10 6 18 6 28 0" stroke="#fff" strokeWidth="2" fill="none" />
    </svg>
  )},
  { key: 'MMA', name: 'MMA', icon: (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <rect x="12" y="12" width="24" height="24" rx="6" fill="#3949ab" />
      <path d="M18 18h12v12H18z" fill="#283593" />
    </svg>
  )},
  { key: 'Boxing', name: 'Boxing', icon: (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <circle cx="18" cy="28" r="8" fill="#e53935" />
      <circle cx="30" cy="20" r="8" fill="#e53935" />
    </svg>
  )},
  { key: 'Volleyball', name: 'Volleyball', icon: (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="#fff59d" stroke="#fbc02d" strokeWidth="2" />
      <path d="M12 12c12 0 18 6 24 12" stroke="#fbc02d" strokeWidth="2" fill="none" />
      <path d="M10 26c10 0 16-6 26-6" stroke="#fbc02d" strokeWidth="2" fill="none" />
    </svg>
  )},
  { key: 'Table tennis', name: 'Table Tennis', icon: (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <circle cx="18" cy="26" r="10" fill="#7e57c2" />
      <rect x="26" y="18" width="10" height="4" fill="#6d4c41" />
      <circle cx="34" cy="20" r="3" fill="#ff7043" />
    </svg>
  )}
];

const SportsStrip = ({ onSelectSport, activeSport }) => {
  const handleActivate = (key) => {
    if (typeof onSelectSport === 'function') onSelectSport(key);
  };
  return (
    <div className="sports-strip" aria-label="Browse sports">
      {sports.map((s) => (
        <div
          key={s.key}
          className={`sport-card ${activeSport === s.key ? 'active' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => handleActivate(s.key)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleActivate(s.key);
          }}
          aria-pressed={activeSport === s.key}
        >
          <div className="sport-icon">{s.icon}</div>
          <div className="sport-label">{s.name}</div>
        </div>
      ))}
    </div>
  );
};

export default SportsStrip;