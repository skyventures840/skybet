import { create } from 'zustand';

// Lightweight store to maintain real-time match odds and metadata
const useOddsStore = create((set, get) => ({
  matchesById: {},

  // Bulk initialize or refresh matches
  setMatches: (matches = []) => {
    const map = {};
    for (const m of matches) {
      if (m && m._id) map[m._id] = m;
    }
    set({ matchesById: map });
  },

  // Upsert a match document
  updateMatch: (match) => {
    if (!match || !match._id) return;
    const current = get().matchesById[match._id] || {};
    set({ matchesById: { ...get().matchesById, [match._id]: { ...current, ...match } } });
  },

  // Update only odds for a match
  updateOdds: (matchId, odds) => {
    if (!matchId) return;
    const current = get().matchesById[matchId] || {};
    set({ matchesById: { ...get().matchesById, [matchId]: { ...current, odds: { ...current.odds, ...odds } } } });
  },

  // Add a brand-new match
  addMatch: (match) => {
    if (!match || !match._id) return;
    set({ matchesById: { ...get().matchesById, [match._id]: match } });
  },

  // Remove a match by id
  deleteMatch: (matchId) => {
    if (!matchId) return;
    const { matchesById } = get();
    const next = { ...matchesById };
    delete next[matchId];
    set({ matchesById: next });
  },
}));

export default useOddsStore;