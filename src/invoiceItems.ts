export type InvoiceDraftItem = {
  id: string;
  item: string;
  description: string;
  quantity: number | null;
  unitCost: number | null;
};

export const createInvoiceDraftItem = (): InvoiceDraftItem => ({
  id: crypto.randomUUID(),
  item: '',
  description: '',
  quantity: null,
  unitCost: null,
});

export const getInvoiceItemAmount = (item: InvoiceDraftItem): number | undefined =>
  item.quantity === null || item.unitCost === null
    ? undefined
    : Math.round(Math.round(item.unitCost * 10000) * item.quantity / 100) / 100;

export const getInvoiceItemTotals = (items: InvoiceDraftItem[]) => ({
  quantity: items.reduce((total, item) => total + (item.quantity ?? 0), 0),
  merchandiseCost: Number(items.reduce((total, item) => total + (getInvoiceItemAmount(item) ?? 0), 0).toFixed(2)),
});

export const validateInvoiceItems = (items: InvoiceDraftItem[]): string | undefined => {
  if (!items.length) return 'Add at least one invoice item.';
  for (const [index, item] of items.entries()) {
    if (!item.item.trim()) return `Enter an item number for item ${index + 1}.`;
    if (item.quantity === null || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      return `Enter a positive whole-number quantity for item ${index + 1}.`;
    }
    if (item.unitCost === null || !Number.isFinite(item.unitCost) || item.unitCost < 0
      || !Number.isSafeInteger(Math.round(item.unitCost * 10000))
      || !Number.isSafeInteger(Math.round(item.unitCost * 10000) * item.quantity)) {
      return `Enter a valid non-negative unit cost for item ${index + 1}.`;
    }
  }
  const totals = getInvoiceItemTotals(items);
  if (!Number.isSafeInteger(totals.quantity) || !Number.isFinite(totals.merchandiseCost)) {
    return 'Invoice item totals are too large.';
  }
  return undefined;
};

export type InvoiceFinancialDraft = {
  items: InvoiceDraftItem[];
  nonMerchCostExTax: number | null;
  allowances: number | null;
  taxRate: number | null;
};

export const invoiceFinancialsChanged = (original: InvoiceFinancialDraft, draft: InvoiceFinancialDraft): boolean =>
  original.nonMerchCostExTax !== draft.nonMerchCostExTax
  || original.allowances !== draft.allowances
  || original.taxRate !== draft.taxRate
  || JSON.stringify(original.items.map(item => [item.quantity, item.unitCost]))
    !== JSON.stringify(draft.items.map(item => [item.quantity, item.unitCost]));

export const reconcileInvoiceLines = <T extends { item: string }>(
  originalItems: InvoiceDraftItem[],
  originalLines: T[],
  items: InvoiceDraftItem[],
  createLine: (item: InvoiceDraftItem, previous: T | undefined) => T,
): T[] => {
  const used = new Set<number>();
  return items.map(item => {
    let index = originalItems.findIndex((previous, i) => previous.id === item.id && !used.has(i));
    if (index < 0) {
      const candidates = originalItems.flatMap((previous, i) =>
        previous.item === item.item && !used.has(i) ? [i] : []);
      if (candidates.length === 1) index = candidates[0];
    }
    if (index >= 0) used.add(index);
    return createLine(item, index >= 0 ? originalLines[index] : undefined);
  });
};
