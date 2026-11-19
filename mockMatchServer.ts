import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import { isMatchDetails } from './src/mockMatches';
import type { MockMatch, MockMatchState } from './src/mockMatches';

const historicalExamples = [
  { orderNo: '6502411', receiptCounts: [1] },
  { orderNo: '6502412', receiptCounts: [2] },
  { orderNo: '6502413', receiptCounts: [2] },
  { orderNo: '6502414', receiptCounts: [2] },
  { orderNo: '6502415', receiptCounts: [1, 1] },
  { orderNo: '6502416', receiptCounts: [1, 1] },
  { orderNo: '6502417', receiptCounts: [1, 1] },
  { orderNo: '6502420', receiptCounts: [1] },
];

const initialMatches: MockMatch[] = [
  ...historicalExamples.flatMap(({ orderNo, receiptCounts }) =>
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

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.trim() === item && item.length > 0)
  && new Set(value).size === value.length;

export function mockMatchServer(): Plugin {
  let version = 0;
  const instanceId = randomUUID();
  const matches = initialMatches.map(match => ({ ...match, invoiceIds: [...match.invoiceIds], receiptNos: [...match.receiptNos] }));
  const currentState = (): MockMatchState => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let updated = false;
    matches.forEach(match => {
      if (match.status === 'Matched' && new Date(match.matchedAt).getTime() < today.getTime()) {
        match.status = 'Posted';
        updated = true;
      }
    });
    if (updated) version += 1;
    return {
      instanceId,
      version,
      matches,
    };
  };
  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const install = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/mock/matches', (req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'GET') {
        send(res, 200, currentState());
        return;
      }
      if (req.method !== 'POST') {
        send(res, 405, { error: 'Method not allowed.' });
        return;
      }
      let body = '';
      let tooLarge = false;
      req.setEncoding('utf8');
      req.on('data', chunk => {
        if (tooLarge) return;
        body += chunk;
        if (body.length > 32768) {
          tooLarge = true;
          body = '';
          send(res, 413, { error: 'Request body is too large.' });
        }
      });
      req.on('error', error => console.error('Mock match request failed:', error));
      req.on('end', () => {
        if (tooLarge) return;
        let payload: unknown;
        try {
          payload = JSON.parse(body);
        } catch {
          send(res, 400, { error: 'Invalid JSON.' });
          return;
        }
        if (!payload || typeof payload !== 'object' || !('orderNo' in payload) || !('invoiceIds' in payload) || !('receiptNos' in payload)
          || typeof payload.orderNo !== 'string' || !payload.orderNo.trim() || payload.orderNo !== payload.orderNo.trim()
          || !isStringList(payload.invoiceIds) || !isStringList(payload.receiptNos)
          || !('details' in payload) || !isMatchDetails(payload.details)) {
          send(res, 400, { error: 'Provide an order, unique invoice IDs, receipt numbers and valid match details.' });
          return;
        }
        const { orderNo, invoiceIds, receiptNos, details } = payload;
        if (details.invoiceNumbers.length !== invoiceIds.length
          || new Set(details.invoiceNumbers.map(invoice => invoice.id)).size !== invoiceIds.length
          || details.invoiceNumbers.some(invoice => !invoiceIds.includes(invoice.id))) {
          send(res, 400, { error: 'Match details must identify each selected invoice.' });
          return;
        }
        const conflict = matches.some(match =>
          match.invoiceIds.some(id => invoiceIds.includes(id))
          || (match.orderNo === orderNo && match.receiptNos.some(number => receiptNos.includes(number))),
        );
        if (conflict) {
          send(res, 409, { error: 'An invoice or receipt has already been matched.', ...currentState() });
          return;
        }
        matches.push({ orderNo, invoiceIds, receiptNos, details, matchedAt: new Date().toISOString(), status: 'Matched' });
        version += 1;
        send(res, 201, currentState());
      });
    });
  };
  return {
    name: 'mock-match-service',
    configureServer: install,
    configurePreviewServer: install,
  };
}
