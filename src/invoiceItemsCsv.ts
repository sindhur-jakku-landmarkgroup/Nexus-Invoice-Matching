import Papa from 'papaparse';
import { createInvoiceDraftItem, validateInvoiceItems } from './invoiceItems';
import type { InvoiceDraftItem } from './invoiceItems';

const columns = ['Item number', 'Description', 'Quantity', 'Unit cost ex tax'];
const spreadsheetFormula = /^(?:[\t\r\n]|[\s]*[=+\-@])/;

const unsafeText = (item: InvoiceDraftItem) =>
  spreadsheetFormula.test(item.item) || spreadsheetFormula.test(item.description);

export const exportInvoiceItemsCsv = (items: InvoiceDraftItem[]): { csv: string } | { error: string } => {
  const rows = items.filter(item =>
    item.item !== '' || item.description !== '' || item.quantity !== null || item.unitCost !== null,
  );
  const unsafeIndex = rows.findIndex(unsafeText);
  if (unsafeIndex !== -1) {
    return { error: `Item ${unsafeIndex + 1} contains text that could be interpreted as a spreadsheet formula. Change it before downloading.` };
  }
  return {
    csv: '\uFEFF' + Papa.unparse({
      fields: columns,
      data: rows.map(item => [item.item, item.description, item.quantity ?? '', item.unitCost ?? '']),
    }, { newline: '\r\n' }),
  };
};

export const importInvoiceItemsCsv = (text: string): { items: InvoiceDraftItem[] } | { error: string } => {
  const parsed = Papa.parse<string[]>(text, { delimiter: ',', skipEmptyLines: true });
  if (parsed.errors.length) return { error: `Invalid CSV: ${parsed.errors[0].message}` };
  const [header, ...rows] = parsed.data;
  const normalized = header?.map(value => value.trim().toLowerCase()) ?? [];
  const indexes = columns.map(column => normalized.indexOf(column.toLowerCase()));
  if (normalized.length !== columns.length || indexes.some(index => index < 0) || new Set(indexes).size !== columns.length) {
    return { error: `CSV must contain these columns: ${columns.join(', ')}.` };
  }

  const items: InvoiceDraftItem[] = [];
  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 1;
    if (row.length !== columns.length) return { error: `Item row ${rowNumber} must have ${columns.length} columns.` };
    const [item, description, quantityText, costText] = indexes.map(columnIndex => row[columnIndex]);
    const quantity = quantityText.trim();
    const unitCost = costText.trim();
    if (!/^\d+$/.test(quantity)) return { error: `Item row ${rowNumber}: quantity must be a positive whole number.` };
    if (!/^\d+(?:\.\d{1,4})?$/.test(unitCost)) return { error: `Item row ${rowNumber}: unit cost must be non-negative with up to 4 decimal places.` };
    const draft: InvoiceDraftItem = {
      ...createInvoiceDraftItem(),
      item,
      description,
      quantity: Number(quantity),
      unitCost: Number(unitCost),
    };
    if (unsafeText(draft)) return { error: `Item row ${rowNumber} contains text that could be interpreted as a spreadsheet formula.` };
    const error = validateInvoiceItems([draft]);
    if (error) return { error: `Item row ${rowNumber}: ${error}` };
    items.push(draft);
  }
  const totalsError = items.length ? validateInvoiceItems(items) : undefined;
  return totalsError ? { error: totalsError } : { items };
};
