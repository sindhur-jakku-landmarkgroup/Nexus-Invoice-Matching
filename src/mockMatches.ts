export type MatchResolution = {
  type?: 'invoice' | 'receipt' | 'defer';
  reasonCode?: string;
  comment?: string;
};

export type MatchDetails = {
  invoiceNumbers: { id: string; number: string }[];
  currency: string | null;
  invoiceQty: number;
  receiptQty: number;
  invoiceCost: number;
  receiptCost: number;
  finalInvoiceQty: number;
  finalInvoiceCost: number;
  quantityResolution: MatchResolution;
  costResolution: MatchResolution;
  matchedTotals?: { quantity: number; amount: number };
};

export type MockMatch = {
  orderNo: string;
  invoiceIds: string[];
  receiptNos: string[];
  matchedAt: string;
  status: 'Matched' | 'Posted';
  details?: MatchDetails;
};

export type MockMatchState = {
  instanceId: string;
  version: number;
  matches: MockMatch[];
};

export const getMatchedTotals = (
  details: MatchDetails,
  scope: 'aggregate' | 'unit' | 'unknown',
): { quantity: number | undefined; amount: number | undefined } => {
  if (details.matchedTotals) return details.matchedTotals;
  if (scope === 'unit') return { quantity: details.finalInvoiceQty, amount: details.finalInvoiceCost };
  const selected = (choice: MatchResolution, invoice: number, receipt: number) => {
    if (choice.type === 'invoice') return invoice;
    if (choice.type === 'receipt') return receipt;
    if (!choice.type && invoice === receipt) return invoice;
    return undefined;
  };
  const quantity = selected(details.quantityResolution, details.invoiceQty, details.receiptQty);
  if (scope === 'aggregate') {
    return { quantity, amount: selected(details.costResolution, details.invoiceCost, details.receiptCost) };
  }
  const unchanged = details.invoiceQty === details.receiptQty
    && details.invoiceQty === details.finalInvoiceQty
    && details.invoiceCost === details.receiptCost
    && details.invoiceCost === details.finalInvoiceCost;
  return { quantity, amount: unchanged ? details.invoiceCost : undefined };
};

type ComparisonInvoice = {
  id: string;
  orderNo: string;
  currency: string;
  amount: number;
  lines: { invoiceQty: number }[];
  receipts: { receiptNo: string; quantity: number; amount: number }[];
};

export const getCurrentMatchComparison = (match: MockMatch, invoices: ComparisonInvoice[]) => {
  const orderInvoices = invoices.filter(invoice => invoice.orderNo === match.orderNo);
  const selectedInvoices = match.invoiceIds.map(id => orderInvoices.find(invoice => invoice.id === id));
  const selectedReceipts = match.receiptNos.map(receiptNo =>
    orderInvoices.flatMap(invoice => invoice.receipts).find(receipt => receipt.receiptNo === receiptNo),
  );
  if (!selectedInvoices.length || !selectedReceipts.length
    || selectedInvoices.some(invoice => !invoice) || selectedReceipts.some(receipt => !receipt)) return undefined;
  const documents = selectedInvoices.filter((invoice): invoice is ComparisonInvoice => invoice !== undefined);
  const receipts = selectedReceipts.filter((receipt): receipt is ComparisonInvoice['receipts'][number] => receipt !== undefined);
  const currencies = new Set(documents.map(invoice => invoice.currency));
  return {
    currency: currencies.size === 1 ? documents[0].currency : null,
    invoiceQty: documents.reduce((sum, invoice) => sum + invoice.lines.reduce((total, line) => total + line.invoiceQty, 0), 0),
    receiptQty: receipts.reduce((sum, receipt) => sum + receipt.quantity, 0),
    invoiceCost: documents.reduce((sum, invoice) => sum + invoice.amount, 0),
    receiptCost: receipts.reduce((sum, receipt) => sum + receipt.amount, 0),
  };
};

export const initialMatches: MockMatch[] = [
  ...[
    { orderNo: '6502411', receipts: [[100]] },
    { orderNo: '6502412', receipts: [[50, 50]] },
    { orderNo: '6502413', receipts: [[50, 47]] },
    { orderNo: '6502414', receipts: [[50, 38]] },
    { orderNo: '6502415', receipts: [[100], [100]] },
    { orderNo: '6502416', receipts: [[97], [100]] },
    { orderNo: '6502417', receipts: [[88], [100]] },
    { orderNo: '6502420', receipts: [[100]] },
  ].flatMap(({ orderNo, receipts }) =>
    receipts.map((quantities, index) => {
      const invoiceId = `EX-${orderNo}-${index + 1}`;
      const receiptQty = quantities.reduce((total, quantity) => total + quantity, 0);
      const resolution: MatchResolution = receiptQty === 100 ? {} : { type: 'invoice' };
      return {
        orderNo,
        invoiceIds: [invoiceId],
        receiptNos: quantities.map((_, receiptIndex) => `RCP-${orderNo}-${index + 1}-${receiptIndex + 1}`),
        matchedAt: '2026-10-01T00:00:00.000Z',
        status: 'Posted' as const,
        details: {
          invoiceNumbers: [{ id: invoiceId, number: `INV-${orderNo}-${index + 1}` }],
          currency: 'AED',
          invoiceQty: 100,
          receiptQty,
          invoiceCost: 10000,
          receiptCost: receiptQty * 100,
          finalInvoiceQty: 100,
          finalInvoiceCost: 10000,
          quantityResolution: { ...resolution },
          costResolution: { ...resolution },
          matchedTotals: { quantity: 100, amount: 10000 },
        },
      };
    }),
  ),
  {
    orderNo: '6502401',
    invoiceIds: ['IM-SAMPLE-11'],
    receiptNos: ['RCP-SAMPLE-11'],
    matchedAt: '2026-11-09T00:00:00.000Z',
    status: 'Posted',
    details: {
      invoiceNumbers: [{ id: 'IM-SAMPLE-11', number: 'INV-SAMPLE-11' }],
      currency: 'AED',
      invoiceQty: 60,
      receiptQty: 60,
      invoiceCost: 3000,
      receiptCost: 3000,
      finalInvoiceQty: 60,
      finalInvoiceCost: 3000,
      quantityResolution: {},
      costResolution: {},
      matchedTotals: { quantity: 60, amount: 3000 },
    },
  },
];

export const restoreSeedMatchDetails = (matches: MockMatch[]): boolean => {
  let updated = false;
  for (const match of matches) {
    if (match.details) continue;
    const seed = initialMatches.find(item =>
      item.details && item.orderNo === match.orderNo && item.status === match.status
      && item.matchedAt === match.matchedAt
      && item.invoiceIds.length === match.invoiceIds.length
      && item.invoiceIds.every((id, index) => id === match.invoiceIds[index])
      && item.receiptNos.length === match.receiptNos.length
      && item.receiptNos.every((number, index) => number === match.receiptNos[index]),
    );
    if (seed?.details) {
      match.details = structuredClone(seed.details);
      updated = true;
    }
  }
  return updated;
};

export type MatchRequest = {
  orderNo: string;
  invoiceIds: string[];
  receiptNos: string[];
  details: MatchDetails;
};

export const hasMatchConflict = (matches: MockMatch[], request: MatchRequest): boolean =>
  matches.some(match =>
    match.invoiceIds.some(id => request.invoiceIds.includes(id))
    || (match.orderNo === request.orderNo && match.receiptNos.some(number => request.receiptNos.includes(number))),
  );

const isMatchResolution = (value: unknown): value is MatchResolution => {
  if (!value || typeof value !== 'object') return false;
  const choice = value as Record<string, unknown>;
  return (choice.type === undefined || choice.type === 'invoice' || choice.type === 'receipt' || choice.type === 'defer')
    && (choice.reasonCode === undefined || typeof choice.reasonCode === 'string')
    && (choice.comment === undefined || typeof choice.comment === 'string');
};

export const isMatchDetails = (value: unknown): value is MatchDetails => {
  if (!value || typeof value !== 'object') return false;
  const details = value as Record<string, unknown>;
  return Array.isArray(details.invoiceNumbers)
    && details.invoiceNumbers.length > 0
    && details.invoiceNumbers.every((item: unknown) =>
      !!item && typeof item === 'object' && 'id' in item && 'number' in item
      && typeof item.id === 'string' && item.id.length > 0 && typeof item.number === 'string' && item.number.length > 0)
    && (details.currency === null || (typeof details.currency === 'string' && /^[A-Z]{3}$/.test(details.currency)))
    && [details.invoiceQty, details.receiptQty, details.invoiceCost, details.receiptCost, details.finalInvoiceQty, details.finalInvoiceCost]
      .every(number => typeof number === 'number' && Number.isFinite(number))
    && (details.matchedTotals === undefined || (
      !!details.matchedTotals && typeof details.matchedTotals === 'object'
      && 'quantity' in details.matchedTotals && 'amount' in details.matchedTotals
      && typeof details.matchedTotals.quantity === 'number' && Number.isFinite(details.matchedTotals.quantity)
      && typeof details.matchedTotals.amount === 'number' && Number.isFinite(details.matchedTotals.amount)
    ))
    && isMatchResolution(details.quantityResolution) && isMatchResolution(details.costResolution);
};

export const isMockMatchState = (value: unknown): value is MockMatchState => {
  if (!value || typeof value !== 'object' || !('instanceId' in value) || !('version' in value) || !('matches' in value)
    || typeof value.instanceId !== 'string' || typeof value.version !== 'number' || !Array.isArray(value.matches)) return false;
  return value.matches.every(match =>
    match && typeof match === 'object' && typeof match.orderNo === 'string'
    && Array.isArray(match.invoiceIds) && match.invoiceIds.every((id: unknown) => typeof id === 'string')
    && Array.isArray(match.receiptNos) && match.receiptNos.every((number: unknown) => typeof number === 'string')
    && typeof match.matchedAt === 'string' && !Number.isNaN(Date.parse(match.matchedAt))
    && (match.status === 'Matched' || match.status === 'Posted')
    && (match.details === undefined || isMatchDetails(match.details)),
  );
};
