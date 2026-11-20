import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let invoices;

before(async () => {
  server = await createServer({ logLevel: 'silent', server: { middlewareMode: true } });
  ({ initialInvoices: invoices } = await server.ssrLoadModule('/src/App.tsx'));
});

after(async () => {
  if (server) await server.close();
});

test('sample receipt items reconcile with their own receipt totals', () => {
  const receipts = invoices.flatMap(invoice => invoice.receipts);
  assert.ok(receipts.length);
  for (const receipt of receipts) {
    assert.ok(receipt.items.length, `${receipt.receiptNo} has no items`);
    assert.equal(receipt.items.reduce((sum, item) => sum + item.quantity, 0), receipt.quantity, receipt.receiptNo);
    assert.equal(Number(receipt.items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)), receipt.amount, receipt.receiptNo);
  }
});

test('multiple receipts keep separate item details when invoice lines change', () => {
  const invoice = invoices.find(item => item.orderNo === '6502402');
  const [first, second] = invoice.receipts;
  const firstItems = structuredClone(first.items);
  const secondItems = structuredClone(second.items);
  const originalItem = invoice.lines[0].item;
  assert.notDeepEqual(firstItems, secondItems);
  assert.notStrictEqual(first.items, second.items);
  try {
    invoice.lines[0].item = 'edited-invoice-item';
    assert.deepEqual(first.items, firstItems);
    assert.deepEqual(second.items, secondItems);
  } finally {
    invoice.lines[0].item = originalItem;
  }
});
