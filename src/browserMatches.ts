import { hasMatchConflict, initialMatches, isMockMatchState, restoreSeedMatchDetails } from './mockMatches';
import type { MatchRequest, MockMatchState } from './mockMatches';

const storageKey = 'nexus-invoice-matching.demo-matches.v1';

const withState = async <T>(update: (state: MockMatchState) => T): Promise<T> => {
  if (!navigator.locks) throw new Error('This browser does not support safe demo match storage.');
  return navigator.locks.request(storageKey, () => {
    const stored = localStorage.getItem(storageKey);
    let state: MockMatchState;
    if (stored === null) {
      state = {
        instanceId: crypto.randomUUID(),
        version: 0,
        matches: initialMatches.map(match => ({ ...match, invoiceIds: [...match.invoiceIds], receiptNos: [...match.receiptNos] })),
      };
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(stored);
      } catch {
        throw new Error('Saved demo match data is invalid.');
      }
      if (!isMockMatchState(parsed)) throw new Error('Saved demo match data is invalid.');
      state = parsed;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let updated = restoreSeedMatchDetails(state.matches);
    state.matches.forEach(match => {
      if (match.status === 'Matched' && new Date(match.matchedAt).getTime() < today.getTime()) {
        match.status = 'Posted';
        updated = true;
      }
    });
    if (updated) state.version += 1;
    const result = update(state);
    localStorage.setItem(storageKey, JSON.stringify(state));
    return result;
  });
};

export const getBrowserMatches = (): Promise<MockMatchState> => withState(state => state);

export const saveBrowserMatch = (request: MatchRequest): Promise<{ state: MockMatchState; conflict: boolean }> =>
  withState(state => {
    if (hasMatchConflict(state.matches, request)) return { state, conflict: true };
    state.matches.push({ ...request, matchedAt: new Date().toISOString(), status: 'Matched' });
    state.version += 1;
    return { state, conflict: false };
  });
