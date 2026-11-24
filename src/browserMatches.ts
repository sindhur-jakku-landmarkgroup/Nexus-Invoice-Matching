import { hasMatchConflict, initialMatches } from './mockMatches';
import type { MatchRequest, MockMatchState } from './mockMatches';

export const createBrowserMatchSession = () => {
  let state: MockMatchState = {
    instanceId: 'page-session',
    version: 0,
    matches: structuredClone(initialMatches),
  };

  return {
    getMatches: async (): Promise<MockMatchState> => state,
    saveMatch: async (request: MatchRequest): Promise<{ state: MockMatchState; conflict: boolean }> => {
      if (hasMatchConflict(state.matches, request)) return { state, conflict: true };
      state = {
        ...state,
        version: state.version + 1,
        matches: [...state.matches, { ...structuredClone(request), matchedAt: new Date().toISOString(), status: 'Matched' }],
      };
      return { state, conflict: false };
    },
  };
};
