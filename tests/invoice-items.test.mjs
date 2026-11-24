import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let getInvoiceItemTotals;
let validateInvoiceItems;
let exportInvoiceItemsCsv;
let importInvoiceItemsCsv;
let invoiceFinancialsChanged;
let reconcileInvoiceLines;
let hasDuplicateInvoice;
let getItemNumberDifferences;
let localDateInputValue;
let unitCostsDiffer;
let costResolutionRequired;
let updateOrderSelection;

before(async () => {
  server = await createServer({ logLevel: 'silent', server: { middlewareMode: true } });
  ({ getInvoiceItemTotals, validateInvoiceItems, invoiceFinancialsChanged, reconcileInvoiceLines } = await server.ssrLoadModule('/src/invoiceItems.ts'));
  ({ exportInvoiceItemsCsv, importInvoiceItemsCsv } = await server.ssrLoadModule('/src/invoiceItemsCsv.ts'));
  ({ hasDuplicateInvoice, getItemNumberDifferences, localDateInputValue, unitCostsDiffer, costResolutionRequired, updateOrderSelection } = await server.ssrLoadModule('/src/matchingRules.ts'));
});

after(async () => {
  if (server) await server.close();
});

const item = (id, quantity, unitCost) => ({ id, item: id, description: '', quantity, unitCost });

test('selecting another order clears both invoice and receipt selections', () => {
  let selected = { invoicesByOrder: {}, receiptsByOrder: {} };
  selected = updateOrderSelection(selected, 'A', 'invoice', 'i1', true);
  selected = updateOrderSelection(selected, 'A', 'invoice', 'i2', true);
  selected = updateOrderSelection(selected, 'A', 'receipt', 'r1', true);
  assert.deepEqual(selected, { invoicesByOrder: { A: ['i1', 'i2'] }, receiptsByOrder: { A: ['r1'] } });
  selected = updateOrderSelection(selected, 'B', 'invoice', 'i3', true);
  assert.deepEqual(selected, { invoicesByOrder: { B: ['i3'] }, receiptsByOrder: { B: [] } });
  selected = updateOrderSelection(selected, 'B', 'receipt', 'r2', true);
  selected = updateOrderSelection(selected, 'A', 'receipt', 'r1', true);
  assert.deepEqual(selected, { invoicesByOrder: { A: [] }, receiptsByOrder: { A: ['r1'] } });
  selected = updateOrderSelection(selected, 'A', 'receipt', 'r1', false);
  assert.deepEqual(selected, { invoicesByOrder: { A: [] }, receiptsByOrder: { A: [] } });
});

test('item totals include each line and update when a line is removed', () => {
  const items = [item('A', 3, 10.25), item('B', 2, 4.5)];
  assert.equal(validateInvoiceItems(items), undefined);
  assert.deepEqual(getInvoiceItemTotals(items), { quantity: 5, merchandiseCost: 39.75 });
  assert.deepEqual(getInvoiceItemTotals(items.slice(1)), { quantity: 2, merchandiseCost: 9 });
  assert.deepEqual(getInvoiceItemTotals([item('C', 1, 1.005)]), { quantity: 1, merchandiseCost: 1.01 });
});

test('creation requires valid item numbers, quantities and unit costs', () => {
  assert.match(validateInvoiceItems([]), /at least one/);
  assert.match(validateInvoiceItems([item(' ', 1, 1)]), /item number/);
  assert.match(validateInvoiceItems([item('A', 0, 1)]), /quantity/);
  assert.match(validateInvoiceItems([item('A', 1.5, 1)]), /quantity/);
  assert.match(validateInvoiceItems([item('A', 1, null)]), /unit cost/);
  assert.match(validateInvoiceItems([item('A', 1, -1)]), /unit cost/);
  assert.equal(validateInvoiceItems([item('A', 1, 0)]), undefined);
});

test('CSV round trip preserves text, quoted content, item order and numeric values', () => {
  const items = [
    { ...item('00123', 3, 10.25), description: 'Blue, "large"\nset' },
    item('B', 2, 4.5),
  ];
  const exported = exportInvoiceItemsCsv(items);
  assert.ok(exported.csv);
  const imported = importInvoiceItemsCsv(exported.csv);
  assert.deepEqual(imported.items.map(({ id, ...rest }) => rest),
    items.map(({ id, ...rest }) => rest));
  assert.deepEqual(getInvoiceItemTotals(imported.items), { quantity: 5, merchandiseCost: 39.75 });
});

test('CSV allows a blank template and edited, reordered rows', () => {
  const empty = exportInvoiceItemsCsv([{ ...item('', null, null), description: '' }]);
  assert.deepEqual(importInvoiceItemsCsv(empty.csv), { items: [] });
  const result = importInvoiceItemsCsv('Description,Item number,Unit cost ex tax,Quantity\r\nEdited,0007,2.50,4\r\nNew,NEW,3.125,2');
  assert.deepEqual(result.items.map(({ item: number, quantity, unitCost }) => ({ number, quantity, unitCost })), [
    { number: '0007', quantity: 4, unitCost: 2.5 },
    { number: 'NEW', quantity: 2, unitCost: 3.125 },
  ]);
});

test('CSV rejects malformed files, incomplete or unsafe rows without returning items', () => {
  const invalidFiles = [
    'Wrong,Description,Quantity,Unit cost ex tax\nA,test,1,2',
    'Item number,Description,Quantity,Unit cost ex tax\n"unterminated,test,1,2',
    'Item number,Description,Quantity,Unit cost ex tax\nA,test,1',
    'Item number,Description,Quantity,Unit cost ex tax\nA,test,1.5,2',
    'Item number,Description,Quantity,Unit cost ex tax\nA,test,1,2.12345',
    'Item number,Description,Quantity,Unit cost ex tax\nA,test,0,2',
    'Item number,Description,Quantity,Unit cost ex tax\nA,"  =1+1",1,2',
  ];
  for (const text of invalidFiles) assert.ok(importInvoiceItemsCsv(text).error);
  assert.match(exportInvoiceItemsCsv([{ ...item('A', 1, 2), description: '@formula' }]).error, /spreadsheet formula/);
});

test('only financial changes recalculate an existing invoice total', () => {
  const original = { items: [item('A', 3, 10)], nonMerchCostExTax: null, allowances: null, taxRate: null };
  assert.equal(invoiceFinancialsChanged(original, { ...original, items: [{ ...original.items[0], description: 'Changed' }] }), false);
  assert.equal(invoiceFinancialsChanged(original, { ...original, items: [item('A', 4, 10)] }), true);
  assert.equal(invoiceFinancialsChanged(original, { ...original, nonMerchCostExTax: 0 }), true);
  assert.equal(invoiceFinancialsChanged(original, { ...original, taxRate: 5 }), true);
});

test('editing or importing lines preserves receipt metadata for identifiable items', () => {
  const original = [item('A', 1, 2), item('B', 2, 3)];
  const lines = [{ item: 'A', receiptQty: 7 }, { item: 'B', receiptQty: 8 }];
  const edited = [{ ...original[1], id: 'imported-B' }, { ...original[0], item: 'A-renamed' }, item('C', 1, 2)];
  const result = reconcileInvoiceLines(original, lines, edited, (row, old) => ({
    item: row.item, receiptQty: old?.receiptQty ?? 0,
  }));
  assert.deepEqual(result, [{ item: 'B', receiptQty: 8 }, { item: 'A-renamed', receiptQty: 7 }, { item: 'C', receiptQty: 0 }]);
});

test('duplicate invoice numbers are scoped to supplier site and exclude the edited invoice', () => {
  const invoices = [{ id: '1', invoiceNo: 'Inv-1', supplierSite: '001' }];
  assert.equal(hasDuplicateInvoice(invoices, ' inv-1 ', '001'), true);
  assert.equal(hasDuplicateInvoice(invoices, 'INV-1', '002'), false);
  assert.equal(hasDuplicateInvoice(invoices, 'INV-1', '001', '1'), false);
});

test('item differences compare selected groups without assuming document allocations', () => {
  assert.deepEqual(getItemNumberDifferences([' 001 ', 'B', 'b'], ['001', 'c']), {
    invoiceOnly: ['b'], receiptOnly: ['c'],
  });
  assert.deepEqual(getItemNumberDifferences(['A', 'B'], ['b', 'a']), { invoiceOnly: [], receiptOnly: [] });
});

test('new dates use local calendar dates and unit cost comparison ignores quantity', () => {
  assert.equal(localDateInputValue(new Date(2026, 10, 20, 23, 45)), '2026-11-20');
  assert.equal(unitCostsDiffer(100, 9700 / 97), false);
  assert.equal(unitCostsDiffer(100, 101), true);
  assert.equal(costResolutionRequired(false, 10000, 9700, 100, 97), false);
  assert.equal(costResolutionRequired(false, 10000, 9894, 100, 97), true);
  assert.equal(costResolutionRequired(false, 10000, 0, 100, 0), undefined);
  assert.equal(costResolutionRequired(true, 10000, 9700, 100, 97), true);
});
