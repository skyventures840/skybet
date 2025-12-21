// Lightweight sport icon utility for consistent icons across the app
// Usage: getSportIcon('soccer') or getSportIcon('Soccer')
// Falls back to a generic ball icon when sport is unknown

import React from 'react';

const normalize = (s) => String(s || '').toLowerCase().trim();

// Basic aliasing for common keys → display names
const ALIASES = {
  football: 'american football',
  americanfootball: 'american football',
  icehockey: 'hockey',
  tabletennis: 'table tennis'
};

const ICONS = {
  aviator: (
    <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true" style={{ overflow: 'visible' }}>
      {/* Far Wing */}
      <path d="M20 22 L10 10 L18 10 L30 22" fill="#b71c1c" />
      
      {/* Tail Fin */}
      <path d="M10 24 L4 10 L10 10 L12 24" fill="#d32f2f" />
      
      {/* Fuselage Body */}
      <path d="M44 28 C44 24, 40 22, 34 22 L24 20 L14 18 L6 24 L0 24 L2 28 L0 32 L6 32 C16 36, 32 34, 40 32 C44 32, 44 28, 44 28 Z" fill="#d32f2f" />
      
      {/* Cockpit Window */}
      <path d="M34 22 L28 22 L26 18 L32 18 Z" fill="#cfd8dc" opacity="0.9" />
      
      {/* Near Wing */}
      <path d="M30 24 L20 40 L28 40 L38 24 Z" fill="#ef5350" />
      
      {/* Propeller Blur */}
      <circle cx="44" cy="28" r="6" fill="rgba(255,255,255,0.2)" />
      <ellipse cx="44" cy="28" rx="2" ry="8" fill="rgba(50,50,50,0.5)" transform="rotate(45, 44, 28)" />
      
      {/* Wheels */}
      <circle cx="26" cy="38" r="3.5" fill="#212121" />
      <path d="M26 32 L26 38" stroke="#212121" strokeWidth="2" />
    </svg>
  ),
  soccer: (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#ffffff" stroke="#222" strokeWidth="2" />
      <polygon points="24,12 18,18 20,26 28,26 30,18" fill="#3b3b3b" />
      <polygon points="12,24 18,18 14,12 8,14 6,20" fill="#3b3b3b" />
      <polygon points="36,24 30,18 34,12 40,14 42,20" fill="#3b3b3b" />
      <polygon points="20,36 18,28 10,28 12,34 16,36" fill="#3b3b3b" />
      <polygon points="28,36 30,28 38,28 36,34 32,36" fill="#3b3b3b" />
    </svg>
  ),
  hockey: (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <rect x="8" y="30" width="32" height="6" rx="3" fill="#607d8b" />
      <rect x="26" y="12" width="4" height="18" fill="#8d6e63" />
      <rect x="16" y="20" width="4" height="10" fill="#8d6e63" />
    </svg>
  ),
  tennis: (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="#8bc34a" />
      <path d="M10 20c8 0 12 8 28 8" stroke="#fff" strokeWidth="3" fill="none" />
      <path d="M14 28c8 0 12-8 24-8" stroke="#fff" strokeWidth="3" fill="none" />
    </svg>
  ),
  basketball: (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="#f57c00" />
      <path d="M24 6v36" stroke="#5d4037" strokeWidth="3" />
      <path d="M6 24h36" stroke="#5d4037" strokeWidth="3" />
      <path d="M12 12c8 8 8 16 0 24" stroke="#5d4037" strokeWidth="3" fill="none" />
      <path d="M36 12c-8 8-8 16 0 24" stroke="#5d4037" strokeWidth="3" fill="none" />
    </svg>
  ),
  baseball: (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="#ffffff" stroke="#bdbdbd" strokeWidth="2" />
      <path d="M12 16c4 4 4 12 0 16" stroke="#d32f2f" strokeWidth="2" fill="none" />
      <path d="M36 16c-4 4-4 12 0 16" stroke="#d32f2f" strokeWidth="2" fill="none" />
    </svg>
  ),
  'american football': (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <ellipse cx="24" cy="24" rx="18" ry="12" fill="#6d4c41" />
      <path d="M14 24h20" stroke="#fff" strokeWidth="3" />
      <path d="M18 20v8M22 20v8M26 20v8M30 20v8" stroke="#fff" strokeWidth="2" />
    </svg>
  ),
  cricket: (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <circle cx="16" cy="24" r="8" fill="#c62828" />
      <rect x="26" y="12" width="4" height="20" fill="#a1887f" />
      <rect x="32" y="12" width="4" height="20" fill="#a1887f" />
    </svg>
  ),
  rugby: (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <ellipse cx="24" cy="24" rx="18" ry="12" fill="#8e24aa" />
      <path d="M10 20c10 6 18 6 28 0" stroke="#fff" strokeWidth="2" fill="none" />
    </svg>
  ),
  mma: (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <rect x="12" y="12" width="24" height="24" rx="6" fill="#3949ab" />
      <path d="M18 18h12v12H18z" fill="#283593" />
    </svg>
  ),
  boxing: (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <circle cx="18" cy="28" r="8" fill="#e53935" />
      <circle cx="30" cy="20" r="8" fill="#e53935" />
    </svg>
  ),
  volleyball: (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="#fff59d" stroke="#fbc02d" strokeWidth="2" />
      <path d="M12 12c12 0 18 6 24 12" stroke="#fbc02d" strokeWidth="2" fill="none" />
      <path d="M10 26c10 0 16-6 26-6" stroke="#fbc02d" strokeWidth="2" fill="none" />
    </svg>
  ),
  'table tennis': (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <circle cx="18" cy="26" r="10" fill="#7e57c2" />
      <rect x="26" y="18" width="10" height="4" fill="#6d4c41" />
      <circle cx="34" cy="20" r="3" fill="#ff7043" />
    </svg>
  )
};

const DEFAULT_ICON = (
  <svg viewBox="0 0 48 48" width="24" height="24" aria-hidden="true">
    <circle cx="24" cy="24" r="18" fill="#ddd" stroke="#888" strokeWidth="2" />
  </svg>
);

export function getSportIcon(sportKeyOrName) {
  const raw = normalize(sportKeyOrName);
  const key = ALIASES[raw] || raw;
  return ICONS[key] || DEFAULT_ICON;
}

export default getSportIcon;