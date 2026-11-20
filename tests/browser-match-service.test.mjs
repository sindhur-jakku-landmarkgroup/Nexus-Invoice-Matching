import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let getBrowserMatches;
let saveBrowserMatch;
let getCurrentMatchComparison;
let getMatchedTotals;
let stored;
let lockQueue = Promise.resolve();

before(async () => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { locks: { request: (_name, callback) => {
      const result = lockQueue.then(callback);
      lockQueue = result.catch(() => {});
      return result;
    } } },
  });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID } });
  globalThis.localStorage = {
    getItem: () => stored ?? null,
    setItem: (_key, value) => { stored = value; },
  };
  server = await createServer({ logLevel: 'silent', server: { middlewareMode: true } });
  ({ getBrowserMatches, saveBrowserMatch } = await server.ssrLoadModule('/src/browserMatches.ts'));
  ({ getCurrentMatchComparison, getMatchedTotals } = await server.ssrLoadModule('/src/mockMatches.ts'));
});

after(async () => {
  if (server) await server.close();
});

const request = invoiceId => ({
  orderNo: 'DEMO-ORDER',
  invoiceIds: [invoiceId],
  receiptNos: ['DEMO-RECEIPT'],
  details: {
    invoiceNumbers: [{ id: invoiceId, number: invoiceId }],
    currency: 'AED',
    invoiceQty: 1,
    receiptQty: 2,
    invoiceCost: 10,
    receiptCost: 10,
    finalInvoiceQty: 1,
    finalInvoiceCost: 10,
    quantityResolution: { type: 'invoice', reasonCode: 'shortage', comment: 'Checked' },
    costResolution: {},
    matchedTotals: { quantity: 1, amount: 10 },
  },
});

test('browser matches persist and simultaneous claims cannot reuse a receipt', async () => {
  const initial = await getBrowserMatches();
  assert.ok(initial.matches.some(match => match.invoiceIds.includes('EX-6502415-1')));

  const results = await Promise.all(['A', 'B'].map(id => saveBrowserMatch(request(id))));
  assert.deepEqual(results.map(result => result.conflict).sort(), [false, true]);
  const reloaded = await getBrowserMatches();
  assert.equal(reloaded.instanceId, initial.instanceId);
  assert.equal(reloaded.matches.filter(match => match.orderNo === 'DEMO-ORDER').length, 1);
  assert.deepEqual(reloaded.matches.find(match => match.orderNo === 'DEMO-ORDER').details, request('A').details);
});

test('existing example data gains matched totals without changing other matches', async () => {
  const state = await getBrowserMatches();
  for (const match of state.matches.filter(match => match.orderNo !== 'DEMO-ORDER')) delete match.details;
  const userMatch = state.matches.find(match => match.orderNo === 'DEMO-ORDER');
  const existingDetails = structuredClone(userMatch.details);
  stored = JSON.stringify(state);

  const updated = await getBrowserMatches();
  const decision = updated.matches.find(match => match.orderNo === '6502413').details;
  assert.equal(decision.quantityResolution.type, 'invoice');
  assert.equal(decision.costResolution.type, 'invoice');
  assert.equal(decision.receiptQty, 97);
  assert.deepEqual(updated.matches.find(match => match.orderNo === '6502412').details.matchedTotals,
    { quantity: 100, amount: 10000 });
  assert.ok(updated.matches.every(match => match.details?.matchedTotals));
  assert.equal(updated.version, state.version + 1);
  assert.deepEqual(updated.matches.find(match => match.orderNo === 'DEMO-ORDER').details, existingDetails);
  assert.equal((await getBrowserMatches()).version, updated.version);
});

test('invalid saved data and storage failures are reported', async () => {
  stored = '{';
  await assert.rejects(getBrowserMatches(), /Saved demo match data is invalid/);
  stored = undefined;
  const setItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Storage unavailable'); };
  await assert.rejects(getBrowserMatches(), /Storage unavailable/);
  localStorage.setItem = setItem;
});

test('historical comparison uses only matched documents and reports missing documents', () => {
  const match = { orderNo: 'O', invoiceIds: ['I'], receiptNos: ['R1', 'R2'], status: 'Posted', matchedAt: '2026-10-01' };
  const invoices = [{
    id: 'I', orderNo: 'O', currency: 'AED', amount: 10000, lines: [{ invoiceQty: 100 }],
    receipts: [
      { receiptNo: 'R1', quantity: 50, amount: 5000 },
      { receiptNo: 'R2', quantity: 47, amount: 4700 },
      { receiptNo: 'R3', quantity: 10, amount: 1000 },
    ],
  }];
  assert.deepEqual(getCurrentMatchComparison(match, invoices), {
    currency: 'AED', invoiceQty: 100, receiptQty: 97, invoiceCost: 10000, receiptCost: 9700,
  });
  assert.equal(getCurrentMatchComparison({ ...match, receiptNos: ['missing'] }, invoices), undefined);
  assert.equal(getCurrentMatchComparison({ ...match, invoiceIds: ['missing'] }, invoices), undefined);
});

test('matched totals reflect the chosen basis and preserve item-level results', () => {
  const details = {
    ...request('I').details,
    matchedTotals: undefined,
    invoiceQty: 100, receiptQty: 97, invoiceCost: 10000, receiptCost: 9700,
    finalInvoiceQty: 97, finalInvoiceCost: 9800,
    quantityResolution: { type: 'receipt' }, costResolution: { type: 'invoice' },
  };
  assert.deepEqual(getMatchedTotals(details, 'aggregate'), { quantity: 97, amount: 10000 });
  assert.deepEqual(getMatchedTotals({ ...details, quantityResolution: { type: 'invoice' }, costResolution: { type: 'receipt' } }, 'aggregate'),
    { quantity: 100, amount: 9700 });
  assert.deepEqual(getMatchedTotals(details, 'unit'), { quantity: 97, amount: 9800 });
  assert.deepEqual(getMatchedTotals(details, 'unknown'), { quantity: 97, amount: undefined });
  assert.deepEqual(getMatchedTotals({ ...details, matchedTotals: { quantity: 97, amount: 9800 } }, 'unknown'),
    { quantity: 97, amount: 9800 });
  assert.deepEqual(getMatchedTotals({ ...details, quantityResolution: {}, costResolution: { type: 'defer' } }, 'aggregate'),
    { quantity: undefined, amount: undefined });
});
