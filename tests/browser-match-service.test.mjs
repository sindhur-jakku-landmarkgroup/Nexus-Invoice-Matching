import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let getBrowserMatches;
let saveBrowserMatch;
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
    receiptQty: 1,
    invoiceCost: 10,
    receiptCost: 10,
    finalInvoiceQty: 1,
    finalInvoiceCost: 10,
    quantityResolution: {},
    costResolution: {},
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

test('invalid saved data and storage failures are reported', async () => {
  stored = '{';
  await assert.rejects(getBrowserMatches(), /Saved demo match data is invalid/);
  stored = undefined;
  const setItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Storage unavailable'); };
  await assert.rejects(getBrowserMatches(), /Storage unavailable/);
  localStorage.setItem = setItem;
});
