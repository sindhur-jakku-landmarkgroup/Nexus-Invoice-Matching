import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let createBrowserMatchSession;
let getCurrentMatchComparison;
let getMatchedTotals;

before(async () => {
  server = await createServer({ logLevel: 'silent', server: { middlewareMode: true } });
  ({ createBrowserMatchSession } = await server.ssrLoadModule('/src/browserMatches.ts'));
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

test('matches remain in the page session and simultaneous claims cannot reuse a receipt', async () => {
  const session = createBrowserMatchSession();
  const initial = await session.getMatches();
  assert.ok(initial.matches.some(match => match.invoiceIds.includes('EX-6502415-1')));

  const results = await Promise.all(['A', 'B'].map(id => session.saveMatch(request(id))));
  assert.deepEqual(results.map(result => result.conflict).sort(), [false, true]);
  const current = await session.getMatches();
  assert.equal(initial.matches.some(match => match.orderNo === 'DEMO-ORDER'), false);
  assert.equal(current.matches.filter(match => match.orderNo === 'DEMO-ORDER').length, 1);
  assert.deepEqual(current.matches.find(match => match.orderNo === 'DEMO-ORDER').details, request('A').details);
});

test('a fresh page session restores seeded matches without affecting other open sessions', async () => {
  const first = createBrowserMatchSession();
  const second = createBrowserMatchSession();
  await first.saveMatch(request('A'));
  assert.equal((await second.getMatches()).matches.some(match => match.orderNo === 'DEMO-ORDER'), false);

  const refreshed = createBrowserMatchSession();
  const baseline = await refreshed.getMatches();
  assert.equal(baseline.matches.some(match => match.orderNo === 'DEMO-ORDER'), false);
  assert.equal(baseline.matches.find(match => match.orderNo === '6502413').status, 'Posted');
  assert.deepEqual(baseline.matches.find(match => match.orderNo === '6502412').details.matchedTotals,
    { quantity: 100, amount: 10000 });
  assert.equal((await first.getMatches()).matches.some(match => match.orderNo === 'DEMO-ORDER'), true);
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
