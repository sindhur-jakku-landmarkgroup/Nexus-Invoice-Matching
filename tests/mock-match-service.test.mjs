import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let endpoint;

before(async () => {
  server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  endpoint = `http://127.0.0.1:${server.httpServer.address().port}/api/mock/matches`;
});

after(async () => {
  if (server) await server.close();
});

const detailsFor = id => ({
  invoiceNumbers: [{ id, number: `INV-${id}` }],
  currency: 'AED',
  invoiceQty: 100,
  receiptQty: 97,
  invoiceCost: 10000,
  receiptCost: 9700,
  finalInvoiceQty: 97,
  finalInvoiceCost: 9700,
  quantityResolution: { type: 'receipt', reasonCode: 'shortage', comment: 'Verified' },
  costResolution: { type: 'invoice', comment: 'Price confirmed' },
});

const postMatch = payload => fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

test('historical matches retain their mapping without inventing resolution details', async () => {
  const state = await (await fetch(endpoint)).json();
  const match = state.matches.find(item => item.invoiceIds.includes('EX-6502415-1'));
  assert.deepEqual(match.receiptNos, ['RCP-6502415-1-1']);
  assert.equal(match.status, 'Posted');
  assert.equal(match.details, undefined);
});

test('match details must be valid and identify the selected invoices', async () => {
  const invalid = await postMatch({
    orderNo: 'TEST-INVALID',
    invoiceIds: ['A'],
    receiptNos: ['R'],
    details: { ...detailsFor('A'), invoiceQty: '100' },
  });
  assert.equal(invalid.status, 400);
  const wrongInvoice = await postMatch({
    orderNo: 'TEST-INVALID',
    invoiceIds: ['A'],
    receiptNos: ['R'],
    details: detailsFor('B'),
  });
  assert.equal(wrongInvoice.status, 400);
});

test('competing matches reserve a receipt once and share the recorded decisions', async () => {
  const responses = await Promise.all(['A', 'B'].map(id => postMatch({
    orderNo: 'TEST-RACE',
    invoiceIds: [id],
    receiptNos: ['R1', 'R2'],
    details: detailsFor(id),
  })));
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  const state = await (await fetch(endpoint)).json();
  const match = state.matches.find(item => item.orderNo === 'TEST-RACE');
  assert.deepEqual(match.receiptNos, ['R1', 'R2']);
  assert.deepEqual(match.details, detailsFor(match.invoiceIds[0]));
  const conflict = await postMatch({
    orderNo: 'TEST-RACE',
    invoiceIds: ['C'],
    receiptNos: ['R2'],
    details: detailsFor('C'),
  });
  assert.equal(conflict.status, 409);
});
