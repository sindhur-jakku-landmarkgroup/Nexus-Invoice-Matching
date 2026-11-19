# Resolve Discrepancy Modal - Visual Layout & Technical Reference

## Modal Overview
The "Resolve Discrepancy" modal is a unified component that handles both quantity and cost variance resolution in a single interface, matching the legacy ReIM application design.

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Resolve Discrepancy                                                    │
│  Variance Resolution                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  HEADER SECTION (READ-ONLY)                                             │
│  ─────────────────────────────                                          │
│  Item: HC-880142 Cotton duvet set, king                                │
│  Invoice: INV-260381          Order No. 6502391                        │
│  Receipt: RCP-723842 or Multiple                                       │
│                                                                          │
│  ┌────────────────────────────────┬────────────────────────────────┐   │
│  │ LEFT COLUMN                    │ RIGHT COLUMN                   │   │
│  │ Selection Options              │ Reason Codes & Comments        │   │
│  ├────────────────────────────────┼────────────────────────────────┤   │
│  │                                │                                │   │
│  │ Quantity Resolution            │ Quantity Resolution Details    │   │
│  │ ─────────────────────          │ ─────────────────────────      │   │
│  │                                │                                │   │
│  │ ○ Invoice Quantity             │ Reason Code:                   │   │
│  │   320 units                    │ [Dropdown ▼]                  │   │
│  │                                │                                │   │
│  │ ● Receipt Quantity (default)   │ Comment:                       │   │
│  │   325 units                    │ [Text Area ─────────────]      │   │
│  │                                │                                │   │
│  │ ○ Defer Quantity Resolution    │                                │   │
│  │                                │                                │   │
│  │ ▶ Multiple Reason Codes        │                                │   │
│  │   (expandable text)             │                                │   │
│  │                                │                                │   │
│  ├────────────────────────────────┼────────────────────────────────┤   │
│  │                                │                                │   │
│  │ Unit Cost Resolution           │ Unit Cost Resolution Details   │   │
│  │ ─────────────────────          │ ─────────────────────────────  │   │
│  │                                │                                │   │
│  │ ○ Invoice Unit Cost            │ Reason Code:                   │   │
│  │   AED 74.60                    │ [Dropdown ▼]                  │   │
│  │                                │                                │   │
│  │ ● Receipt Unit Cost (default)  │ Comment:                       │   │
│  │   AED 74.45                    │ [Text Area ─────────────]      │   │
│  │                                │                                │   │
│  │ ○ Defer Unit Cost Resolution   │                                │   │
│  │                                │                                │   │
│  │ ▶ Multiple Reason Codes        │                                │   │
│  │   (expandable text)             │                                │   │
│  │                                │                                │   │
│  └────────────────────────────────┴────────────────────────────────┘   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  [Cancel]                                              [Apply]          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Interactive Behavior

### 1. Default State (Page Load)
- **Quantity Resolution**: Receipt Quantity is pre-selected
- **Unit Cost Resolution**: Receipt Unit Cost is pre-selected
- **Right Column**: Shows reason code and comment fields for both sections
- **Background Highlight**: Slight blue background (#f0f7ff) on pre-selected receipt options

### 2. User Selects "Defer Quantity Resolution"
- Radio button for "Defer Quantity Resolution" becomes selected
- Right column hides the "Quantity Resolution Details" section
- "Unit Cost Resolution Details" remains visible (if not deferred)

### 3. User Selects "Defer Unit Cost Resolution"
- Radio button for "Defer Unit Cost Resolution" becomes selected
- Right column hides the "Unit Cost Resolution Details" section
- "Quantity Resolution Details" remains visible (if not deferred)

### 4. Both Selections are "Defer"
- Right column displays centered message:
  - "Both quantity and cost resolutions are deferred."
  - "No reason code or comment required."
- No input fields are visible

### 5. User Selects "Invoice Quantity" or "Invoice Unit Cost"
- Right column displays reason code dropdown and comment field
- Reason code is required before applying
- Comment is optional but recommended

## Component Structure (React/TypeScript)

```typescript
// State Management
const [resolveDiscrepancyOpen, setResolveDiscrepancyOpen] = useState(false);
const [quantityResolution, setQuantityResolution] = useState<ResolutionChoice>(
  { type: 'receipt' }  // Default: receipt quantity
);
const [costResolution, setCostResolution] = useState<ResolutionChoice>(
  { type: 'receipt' }  // Default: receipt cost
);

// Data Persistence
type ResolutionChoice = {
  type: 'invoice' | 'receipt' | 'defer';
  reasonCode?: string;
  comment?: string;
};

// Invoice Integration
type Invoice = {
  // ... other fields
  quantityResolution?: ResolutionChoice;
  costResolution?: ResolutionChoice;
};
```

## Reason Code Options

```
Damaged goods
Shortage
Overcharge
Pricing error
Quantity discrepancy
Other
```

## Modal Dimensions & Styling

- **Width**: 1000px
- **Max Height**: 78vh with vertical scroll
- **Two-Column Layout**: Equal width (1fr 1fr)
- **Gap between columns**: 32px
- **Header Background**: #f5f7fa with 1px border
- **Radio Button Styling**: Custom padding and border-radius
- **Pre-selected Highlight**: Light blue background (#f0f7ff)

## Mobile Responsive Behavior

On screens < 1024px width:
- Layout switches to single column (stacked vertically)
- Left column displays above right column
- Full width utilization for better mobile experience
- All interactive elements remain fully functional

## Button Actions

### Cancel Button
```typescript
onClick={() => setResolveDiscrepancyOpen(false)}
```
- Closes modal without saving
- All changes are discarded

### Apply Button
```typescript
onClick={handleApplyDiscrepancyResolution}
```
- Validates selections
- Saves both resolutions to invoice object
- If not deferring: applies values to invoice lines
- Recalculates invoice amount if cost changed
- Shows success message: "Discrepancy resolution applied successfully."
- Closes modal automatically

## Integration Points in UI

### Location 1: Variance Resolution Section
- Position: Top variance detection area
- Visibility: Only when line variance detected (hasLineVariance)
- Both buttons trigger same modal

### Location 2: Receipt Selection Section
- Position: Below receipt radio group
- Visibility: Only when receipt selected AND variance detected
- Both buttons trigger same modal with fresh state initialization

## Code Implementation

### Modal Container
```jsx
<Modal
  className="resolve-discrepancy-modal"
  title={<div className="resolution-modal-title">
    <span>Resolve Discrepancy</span>
    <Tag color="processing">Variance Resolution</Tag>
  </div>}
  open={resolveDiscrepancyOpen}
  onCancel={() => setResolveDiscrepancyOpen(false)}
  width={1000}
  footer={[
    <Button key="cancel" onClick={() => setResolveDiscrepancyOpen(false)}>
      Cancel
    </Button>,
    <Button key="apply" type="primary" onClick={handleApplyDiscrepancyResolution}>
      Apply
    </Button>,
  ]}
>
  {/* Modal content with left and right columns */}
</Modal>
```

### Header Display
```jsx
<div className="discrepancy-header">
  <div className="header-row">
    <div className="header-field">
      <span className="label">Item:</span>
      <span className="value">
        {selectedInvoice.lines[0]?.item} {selectedInvoice.lines[0]?.description}
      </span>
    </div>
  </div>
  {/* Invoice, Order No, Receipt fields */}
</div>
```

### Two-Column Layout
```jsx
<div className="discrepancy-body" 
  style={{
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 32,
    marginTop: 24
  }}>
  {/* Left Column: Quantity & Cost Options */}
  {/* Right Column: Reason Codes & Comments */}
</div>
```

## CSS Classes

```css
.resolve-discrepancy-modal .ant-modal-body { max-height: 78vh; overflow-y: auto; }
.resolve-discrepancy-content { display: flex; flex-direction: column; gap: 24px; }
.discrepancy-header { padding: 16px; background: #f5f7fa; border: 1px solid var(--line); border-radius: 6px; }
.header-field { display: flex; gap: 12px; align-items: center; }
.resolution-column-left { display: flex; flex-direction: column; gap: 24px; }
.resolution-column-right { display: flex; flex-direction: column; gap: 24px; }

@media (max-width: 1024px) {
  .discrepancy-body { grid-template-columns: 1fr; gap: 24px; }
}
```

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ User clicks "Qty Resolution" or "Cost Resolution" button        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Initialize state:                                               │
│ - quantityResolution: { type: 'receipt' }                       │
│ - costResolution: { type: 'receipt' }                           │
│ - resolveDiscrepancyOpen: true                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Modal renders with:                                             │
│ - Left column: radio buttons (default: receipt selected)       │
│ - Right column: reason code & comment fields                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ▼                ▼                ▼
┌────────┐   ┌────────────┐   ┌────────────┐
│ Cancel │   │ Defer All  │   │Adjust Sel. │
│        │   │            │   │            │
│ ─────> │   │ ─────>     │   │ ─────>     │
│ Close  │   │ Show msg   │   │ Fill fields│
│ Modal  │   │ Apply btn  │   │ Apply btn  │
└────────┘   └────────────┘   └────────────┘
                     │                │
                     └────────┬───────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ User clicks "Apply"   │
                  │ handleApplyDiscrepan- │
                  │ cyResolution()        │
                  └───────────┬───────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ Save resolutions to   │
                  │ invoice object        │
                  │ Apply values if       │
                  │ not deferring         │
                  │ Recalculate amount    │
                  └───────────┬───────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ Show success message  │
                  │ Close modal           │
                  │ UI updates            │
                  └───────────────────────┘
```

## Test Cases

### TC1: Default Selection - Receipt Values
1. Open modal
2. Verify "Receipt Quantity" is pre-selected
3. Verify "Receipt Unit Cost" is pre-selected
4. Verify reason code & comment fields are visible
5. Expected: Fields are visible and ready for input

### TC2: Change Selection to Invoice Values
1. Select "Invoice Quantity"
2. Select "Invoice Unit Cost"
3. Expected: Same reason code & comment fields remain visible

### TC3: Defer Both Resolutions
1. Select "Defer Quantity Resolution"
2. Select "Defer Unit Cost Resolution"
3. Expected: Right column shows deferred message, no input fields

### TC4: Mixed Defer and Selection
1. Select "Defer Quantity Resolution"
2. Select "Receipt Unit Cost" (default)
3. Expected: Only cost-related fields visible on right

### TC5: Apply Resolutions
1. Select resolution options
2. Fill reason code and comment
3. Click Apply
4. Expected: Modal closes, success message shown, resolutions saved

### TC6: Cancel Without Saving
1. Make selections
2. Fill reason code and comment
3. Click Cancel
4. Expected: Modal closes, no changes saved
