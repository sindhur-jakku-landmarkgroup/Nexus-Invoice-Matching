import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let invoices;
let getFinancePostingLines;

before(async () => {
  server = await createServer({ logLevel: 'silent', server: { middlewareMode: true } });
  ({ initialInvoices: invoices, getFinancePostingLines } = await server.ssrLoadModule('/src/App.tsx'));
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

test('above-threshold invoice has a consistent tax breakdown and still exceeds tolerance', () => {
  const invoice = invoices.find(item => item.invoiceNo === 'INV-260430');
  const { nonMerchCostExTax, taxRate, allowances } = invoice.financialDetails;
  const exTax = invoice.lines.reduce((sum, line) => sum + line.invoiceQty * line.unitCost, 0) + nonMerchCostExTax;
  const tax = Number((exTax * taxRate / 100).toFixed(2));
  assert.equal(Number((exTax + tax - allowances).toFixed(2)), invoice.amount);
  const receiptAmount = invoice.receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
  assert.ok((invoice.amount - receiptAmount) / invoice.amount > 0.05);
});

test('finance lines use the receipt amount and the next local calendar date', () => {
  const now = new Date(2026, 11, 31, 23, 30);
  const result = getFinancePostingLines(9700, now);
  assert.deepEqual(result, [
    { accountCode: '24109-0000-0000', description: 'AP Liability', amount: 9700, glDate: new Date(2027, 0, 1).toLocaleDateString('en-AE') },
    { accountCode: '64318-0000-0000', description: 'Adjustment', amount: 9700, glDate: new Date(2027, 0, 1).toLocaleDateString('en-AE') },
  ]);
  assert.equal(now.getDate(), 31);
});
