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

export const initialMatches: MockMatch[] = [
  ...[
    { orderNo: '6502411', receiptCounts: [1] },
    { orderNo: '6502412', receiptCounts: [2] },
    { orderNo: '6502413', receiptCounts: [2] },
    { orderNo: '6502414', receiptCounts: [2] },
    { orderNo: '6502415', receiptCounts: [1, 1] },
    { orderNo: '6502416', receiptCounts: [1, 1] },
    { orderNo: '6502417', receiptCounts: [1, 1] },
    { orderNo: '6502420', receiptCounts: [1] },
  ].flatMap(({ orderNo, receiptCounts }) =>
    receiptCounts.map((count, index) => ({
      orderNo,
      invoiceIds: [`EX-${orderNo}-${index + 1}`],
      receiptNos: Array.from({ length: count }, (_, receiptIndex) => `RCP-${orderNo}-${index + 1}-${receiptIndex + 1}`),
      matchedAt: '2026-10-01T00:00:00.000Z',
      status: 'Posted' as const,
    })),
  ),
  {
    orderNo: '6502401',
    invoiceIds: ['IM-SAMPLE-11'],
    receiptNos: ['RCP-SAMPLE-11'],
    matchedAt: '2026-11-09T00:00:00.000Z',
    status: 'Posted',
  },
];

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
