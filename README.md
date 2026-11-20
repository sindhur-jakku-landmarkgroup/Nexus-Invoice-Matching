# ReIM Invoice Matching Prototype

A React and TypeScript prototype for the invoice matching modernization workflow. The interface follows the Landmark UI conventions used in the modernization repositories: Vite, React 18, Ant Design, and the shared deep-blue primary theme.

## Run locally

Requirements: Node.js 20 or newer and Yarn 4.

```powershell
corepack yarn install
corepack yarn dev
```

Open the local URL printed by Vite. Production build:

```powershell
corepack yarn build
```

Run the mock-service checks with `corepack yarn test`.

## Prototype scope

- Invoice worklist with search and status filters.
- The Invoice matching menu returns to the first workbench page and clears its filters without discarding selections or prototype documents. All Services, Open RMS Classic and Reports are inactive in this prototype.
- Order cards are paginated (10 per page by default); changing filters or page size returns to the first page.
- Dashboard counts cover all prototype documents regardless of filters. Pending Invoices is the sum of Ready to Match invoices and invoices matched today; Matched Today uses the browser's local date and includes matches from the active mock mode. Unposted Notes, Requests & Memos counts credit notes, requests and memos that are not Posted. The status filter and queue export use document statuses. Exception reporting flags selected invoices without changing their status; confirmation clears their exception flag and marks them Matched.
- Invoice statuses are Ready to Match, Matched, and Posted. Overnight posting is simulated on the next day in the server's local time zone, or the browser's local time zone in browser-only demo mode; no actual posting occurs. A Ready to Match status does not mean the current selection is ready to confirm. If filters hide selected invoices, the card warns that they still count in the totals and offers to clear them.
- Receipt Details shows receipt header, item quantities, unit costs, line amounts and receipt totals without an invoice comparison. Sample receipt lines are stored separately from invoice lines, including for multi-receipt scenarios.
- Explicit receipt-number selection for orders with multiple receipts.
- Confirming a match reserves its receipts for the selected invoice group. Each Matched or Posted group appears separately with its invoices and receipts side by side, without selection checkboxes. Users connected to the same mock server see updates through polling; confirmation handles competing claims with a conflict response. In browser-only demo mode, reservations are limited to the current browser profile.
- View Match Details for a completed group shows the quantity and amount comparison, recorded matching basis, reasons and comments, and matched totals. For aggregate resolutions the totals reflect the selected invoice or receipt values; item-level resolutions use the resulting invoice quantity and amount. These totals are not actual OFIN posting transactions. A group does not imply individual invoice-to-receipt allocations. The posted examples contain illustrative match details. For older saved matches without enough recorded data to determine a matched total, that total is shown as unavailable.
- Select the information icon on an order card to see its matching scenario:

  | Scenario | Ready to Match | Posted (older dates) |
  | --- | --- | --- |
  | One invoice, one matching receipt | 6502318 | 6502411 |
  | One invoice, multiple matching receipts | 6502403 | 6502412 |
  | One invoice, multiple receipts, within 5% | 6502391 | 6502413 |
  | One invoice, multiple receipts, above 5% | 6502402 | 6502414 |
  | Two matching invoice/receipt pairs | 6502404 | 6502415 |
  | Two pairs, one within 5% | 6502405 | 6502416 |
  | Two pairs, one above 5% | 6502406 | 6502417 |

  Select all relevant receipts for the multi-receipt examples. In the generated multi-invoice examples, invoice suffix `-1` corresponds to receipt suffix `-1-1`, and invoice `-2` to receipt `-2-1`. The within-threshold pair has a 3% quantity and cost difference (1.5% combined); the above-threshold pair has a 12% difference (6% combined). Posted examples are historical records for inspection, not available for another match.
- Order 6502420 has one Posted and one Ready to Match invoice with their corresponding receipts. Orders 6502430, 6502431 and 6502432 respectively contain an Approved quantity credit note request, a Posted credit note and a Posted cost debit memo.
- Supplier sites show number followed by name throughout the workbench, and the supplier-site filter can be searched by either. The Document filter supports partial, case-insensitive number matches and shows the matching order with its documents. Reference suppliers are assigned to illustrative prototype orders, not actual supplier transactions; missing descriptions are marked as unavailable.
- A common discrepancy window showing supplier details and quantity and cost choices. For multiple invoices, items, or receipts, or when the invoice amount differs from its line total, choices apply to the selected order totals and record the decision without changing invoice or receipt amounts.
- Order-level quantity and total-cost variances are measured against the selected invoice totals. Up to and including 5% can be resolved; above 5% can be reported using semicolon-separated email addresses. The exception window shows the selected invoice and receipt details. Reports are simulated in the browser; no emails are sent.
- Confirm Match requires an explicit, non-deferred choice for each remaining discrepancy; changing the selected invoices or receipts requires a new resolution.
- The variance summary shows recorded decisions and retains the original variance when invoice values change. Review Resolution reopens the recorded choices for editing.
- General Invoice Maintenance window for creating invoices from the workbench, requiring a supplier site number and name and at least one item with a number, whole-unit quantity and non-negative unit cost. Users can add or remove items; invoice quantity and merchandise cost are calculated from the item lines, while tax, non-merchandise cost and allowances remain in the totals section. Created item lines appear in invoice details and matching.
- Invoice Details uses the same layout in read mode. Ready to Match invoices can be edited and saved with the same item and CSV controls; Matched and Posted invoices cannot be edited. The order number remains fixed to preserve receipt association. Header-only edits preserve the recorded total, including on older invoices without a complete breakdown. Changing quantities, unit costs, tax or charges recalculates the total and requires the missing financial inputs. Saving changes clears the order's unconfirmed resolution.
- Invoice items can be downloaded as a UTF-8 CSV, edited and uploaded. The file has Item number, Description, Quantity and Unit cost ex tax columns; item numbers should be treated as text in spreadsheet software to retain leading zeros. Upload validates the entire file and asks before replacing the current list, so deleting rows in the file removes them from the draft. Text that could be interpreted as a spreadsheet formula is rejected on upload or download.
- Create Note/ Memo records credit notes, cost/quantity/tax credit note requests, cost/quantity/tax debit memos, and cost/quantity credit memos against an existing order and supplier site. Credit Note Request - Quantity is marked Approved; the other types are marked Posted. These are simulated statuses, not actual approvals or postings. The common form records an amount for reference; credit notes remain negative and other types use the entered positive amount. These documents are not matched to receipts, do not post accounting entries, and do not implement type-specific workflows or request matching. The current finance process creates credit notes in Cognix.
- Selectable tax-code breakdown with totals calculated from the selected code and basis.
- CDC exception path with a 7-day grace period and backend-owned exception handling.
- Local invoice tolerance flow using the lower quantity or cost, gated by upstream tax clearance.
- Read-only legacy invoice header and tax-code reference based on the supplied Oracle screenshots.
- Separate ReIM, OFIN, and Cognix integration statuses; Cognix screens and user-triggered Cognix actions are out of scope.

## Mock service and engineering handoff

The GitHub Pages build uses browser-only demo mode: confirmed matches and receipt reservations are saved in the current browser's local storage and survive refreshes. They are shared between tabs using the same browser profile, but not with other users, devices, or browsers. Clearing site data removes them. Browser storage and Web Locks must be available; if not, matching is disabled with an error. This is simulated data, not a shared or production service. Created documents and other edits are not saved on refresh.

The Vite development and preview servers provide an in-memory matching service. Matches, receipt reservations, and the original comparison and resolution details recorded at confirmation are shared between browser tabs using the same server and survive browser refreshes. The server resets to the seeded examples when it restarts; separate server processes do not share state. If the service is unavailable, receipt selection and match confirmation are disabled until it reconnects. Created documents, edits, selections, unconfirmed resolutions, and reports are browser-local and are not shared or persisted on refresh.

The mock service validates request shape and prevents duplicate invoice claims and duplicate order/receipt claims within one process. It does not maintain authoritative invoice or receipt data or validate order membership, allocations, variances, resolution choices, or permissions. It is not a production backend. A production implementation needs authenticated, authorized requests, authoritative server-side domain validation, durable storage, and atomic database transactions with uniqueness constraints for invoice claims and receipt ownership, including concurrent requests across server instances. Aggregate matches associate receipts with an invoice group; they do not establish individual invoice-to-receipt allocations.

Invoice editing rechecks mock match status before saving, but the prototype's browser-local edits and mock matches are not an atomic transaction. A production backend must enforce edit eligibility and concurrency atomically when saving an invoice.

All records and actions are simulated. Integrations with RMS, ReIM, OFIN, Cognix, and STS/SPTS are not connected; cross-application updates are represented as backend statuses rather than user actions.
