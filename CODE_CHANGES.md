# Code Changes for Receipt-Linked Cost & Quantity Resolution

## File Modified
`src/App.tsx`

---

## Change 1: State Management (Lines 480-488)

### Added State Variables
```typescript
const [costResolutionOpen, setCostResolutionOpen] = useState(false);
const [qtyResolutionOpen, setQtyResolutionOpen] = useState(false);
const [costVarianceResolutionOpen, setCostVarianceResolutionOpen] = useState(false);
const [quantityVarianceResolutionOpen, setQuantityVarianceResolutionOpen] = useState(false);
const [selectedResolutionCost, setSelectedResolutionCost] = useState<'invoice' | 'receipt' | 'other'>('invoice');
const [customResolutionCost, setCustomResolutionCost] = useState<number | null>(null);
const [selectedResolutionQty, setSelectedResolutionQty] = useState<'invoice' | 'receipt' | 'other'>('invoice');
const [customResolutionQty, setCustomResolutionQty] = useState<number | null>(null);
```

### Removed Unused Variables
Removed old state variables that were no longer needed:
- `selectedCostOption`
- `setSelectedCostOption`
- `selectedQtyOption`
- `setSelectedQtyOption`
- `costResolutionComment`
- `setCostResolutionComment`
- `qtyResolutionComment`
- `setQtyResolutionComment`
- `costResolutionReason`
- `setCostResolutionReason`
- `qtyResolutionReason`
- `setQtyResolutionReason`
- `costResolutionAmount`
- `setCostResolutionAmount`
- `costResolutionGroup`
- `setCostResolutionGroup`
- `qtyResolutionGroup`
- `setQtyResolutionGroup`

---

## Change 2: Helper Functions (Lines 664-697)

### New Helper: `hasCostVariance()`
```typescript
// Detect if cost variance exists between selected invoice and receipt
const hasCostVariance = () => {
  if (!selectedId || !selectedReceipts[selectedId]) return false;
  const receipt = selectedInvoice.receipts.find(r => r.receiptNo === selectedReceipts[selectedId]);
  if (!receipt) return false;
  const receiptUnitCost = receipt.amount / receipt.quantity;
  return selectedInvoice.lines.some(line => {
    return line.unitCost !== receiptUnitCost;
  });
};
```

**Purpose:**
- Detects cost variance between invoice unitCost and receipt unitCost
- Only checks if receipt is selected
- Returns boolean: true if variance exists, false otherwise

**Logic:**
1. Check if invoice and receipt are selected
2. Find the selected receipt by receiptNo
3. Calculate receipt unit cost: amount ÷ quantity
4. Compare with invoice unitCost
5. Return true if any line has cost variance

---

### New Helper: `hasQuantityVariance()`
```typescript
// Detect if quantity variance exists
const hasQuantityVariance = () => {
  if (!selectedId || !selectedReceipts[selectedId]) return false;
  const receipt = selectedInvoice.receipts.find(r => r.receiptNo === selectedReceipts[selectedId]);
  if (!receipt) return false;
  return selectedInvoice.lines.some(line => {
    return line.invoiceQty !== receipt.quantity;
  });
};
```

**Purpose:**
- Detects quantity variance between invoice invoiceQty and receipt quantity
- Only checks if receipt is selected
- Returns boolean: true if variance exists, false otherwise

**Logic:**
1. Check if invoice and receipt are selected
2. Find the selected receipt by receiptNo
3. Compare invoice invoiceQty with receipt quantity
4. Return true if any line has quantity variance

---

### New Helper: `getSelectedReceipt()`
```typescript
// Get receipt data for comparison
const getSelectedReceipt = () => {
  if (!selectedId || !selectedReceipts[selectedId]) return null;
  return selectedInvoice.receipts.find(r => r.receiptNo === selectedReceipts[selectedId]);
};
```

**Purpose:**
- Retrieves the currently selected receipt object
- Centralizes receipt access for modals
- Returns null if no receipt is selected

**Usage:**
- Used by Cost Selection modal to display receipt data
- Used by Quantity Selection modal to display receipt data
- Ensures modals always work with the correct receipt

---

## Change 3: Receipt-Linked Resolution Buttons (Lines 1141-1158)

### Location
After the receipt radio group and before the match-action-row

### Code
```typescript
{selectedReceipts[selectedId] && (hasCostVariance() || hasQuantityVariance()) && (
  <div className="variance-resolution-actions" style={{marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0'}}>
    <Space>
      <Button 
        disabled={!selectedReceipts[selectedId] || !hasCostVariance()}
        onClick={() => setCostResolutionOpen(true)}
      >
        Cost Resolution
      </Button>
      <Button 
        disabled={!selectedReceipts[selectedId] || !hasQuantityVariance()}
        onClick={() => setQtyResolutionOpen(true)}
      >
        Qty Resolution
      </Button>
    </Space>
  </div>
)}
```

### Rendering Logic
- **Container renders** if: `selectedReceipts[selectedId]` AND (`hasCostVariance()` OR `hasQuantityVariance()`)
- **Cost button enabled** if: `selectedReceipts[selectedId]` AND `hasCostVariance()`
- **Qty button enabled** if: `selectedReceipts[selectedId]` AND `hasQuantityVariance()`

### Styling
- Margin-top: 16px (space from receipt group)
- Padding-top: 16px (internal spacing)
- Border-top: 1px solid #f0f0f0 (visual separator)

---

## Change 4: Cost Resolution Modals (Lines 1370-1445)

### Modal 1: Cost Selection
```typescript
<Modal
  className="cost-resolution-modal"
  title={<div className="resolution-modal-title"><span>Cost Selection</span><Tag color="processing">Cost Variance</Tag></div>}
  open={costResolutionOpen}
  onCancel={() => setCostResolutionOpen(false)}
  width={600}
  footer={[
    <Button key="cancel" onClick={() => setCostResolutionOpen(false)}>Cancel</Button>,
    <Button key="next" type="primary" onClick={() => {
      setCostResolutionOpen(false);
      setCostVarianceResolutionOpen(true);
    }}>
      Next
    </Button>,
  ]}
>
```

**Features:**
- Shows three radio options: Invoice Cost, Receipt Cost, Other
- Displays actual values from invoice and receipt
- Custom input field for "Other" option
- Uses `getSelectedReceipt()` to get receipt data
- Next button transitions to variance resolution modal

**Radio Options:**
```typescript
<label style={{display: 'flex', alignItems: 'center', gap: 10}}>
  <Radio value="invoice" />
  <div>
    <strong>Invoice Cost</strong>
    <span style={{marginLeft: 12, color: '#666'}}>{money(invoiceUnitCost, selectedInvoice.currency)}</span>
  </div>
</label>

<label style={{display: 'flex', alignItems: 'center', gap: 10}}>
  <Radio value="receipt" />
  <div>
    <strong>Receipt Cost</strong>
    <span style={{marginLeft: 12, color: '#666'}}>{money(receiptUnitCost, selectedInvoice.currency)}</span>
  </div>
</label>

<label style={{display: 'flex', alignItems: 'center', gap: 10}}>
  <Radio value="other" />
  <div>
    <strong>Other</strong>
    {selectedResolutionCost === 'other' && (
      <InputNumber 
        style={{marginLeft: 12, width: 150}}
        value={customResolutionCost}
        onChange={setCustomResolutionCost}
        placeholder="Enter amount"
      />
    )}
  </div>
</label>
```

---

### Modal 2: Cost Variance Resolution
```typescript
<Modal
  className="cost-variance-resolution-modal"
  title={<div className="resolution-modal-title"><span>Cost Variance Resolution</span><Tag color="processing">Cost Variance</Tag></div>}
  open={costVarianceResolutionOpen}
  onCancel={() => setCostVarianceResolutionOpen(false)}
  width={700}
  footer={[
    <Button key="cancel" onClick={() => setCostVarianceResolutionOpen(false)}>Cancel</Button>,
    <Button key="ok" type="primary" onClick={() => {
      setCostVarianceResolutionOpen(false);
      messageApi.success('Cost resolution applied');
    }}>
      OK
    </Button>,
  ]}
>
  <div className="resolution-modal-content">
    <div className="resolution-section">
      <h4>Cost Variance Resolution</h4>
      <div className="resolution-fields">
        <label className="resolution-field">
          <span>Reason ID</span>
          <Input placeholder="Enter reason ID or select from list" />
        </label>
        <label className="resolution-field">
          <span>Amount</span>
          <InputNumber 
            style={{width: '100%'}}
            prefix={selectedInvoice.currency}
            placeholder="Enter discrepancy amount"
          />
        </label>
        <label className="resolution-field">
          <span>Comments</span>
          <Input.TextArea 
            rows={3}
            placeholder="Add comments about this resolution"
          />
        </label>
        <label className="resolution-field">
          <span>Re-route to Group (Optional)</span>
          <Input placeholder="Enter group ID or select from list" />
        </label>
        <Button type="primary" style={{marginTop: 8}}>Apply Resolution</Button>
      </div>
    </div>
  </div>
</Modal>
```

**Features:**
- Collects variance documentation
- Reason ID field for tracking
- Amount field for discrepancy value
- Comments field for notes
- Optional re-routing field
- OK button closes modal and shows success message

---

## Change 5: Quantity Resolution Modals (Lines 1447-1590)

### Modal 1: Quantity Selection
```typescript
<Modal
  className="quantity-resolution-modal"
  title={<div className="resolution-modal-title"><span>Quantity Selection</span><Tag color="processing">Quantity Variance</Tag></div>}
  open={qtyResolutionOpen}
  onCancel={() => setQtyResolutionOpen(false)}
  width={600}
  footer={[
    <Button key="cancel" onClick={() => setQtyResolutionOpen(false)}>Cancel</Button>,
    <Button key="next" type="primary" onClick={() => {
      setQtyResolutionOpen(false);
      setQuantityVarianceResolutionOpen(true);
    }}>
      Next
    </Button>,
  ]}
>
```

**Features:**
- Shows three radio options: Invoice Quantity, Receipt Quantity, Other
- Displays actual values from invoice and receipt
- Custom input field for "Other" option
- Uses `getSelectedReceipt()` to get receipt data
- Next button transitions to variance resolution modal

**Radio Options:**
```typescript
<label style={{display: 'flex', alignItems: 'center', gap: 10}}>
  <Radio value="invoice" />
  <div>
    <strong>Invoice Quantity</strong>
    <span style={{marginLeft: 12, color: '#666'}}>{invoiceQty} units</span>
  </div>
</label>

<label style={{display: 'flex', alignItems: 'center', gap: 10}}>
  <Radio value="receipt" />
  <div>
    <strong>Receipt Quantity</strong>
    <span style={{marginLeft: 12, color: '#666'}}>{receipt.quantity} units</span>
  </div>
</label>

<label style={{display: 'flex', alignItems: 'center', gap: 10}}>
  <Radio value="other" />
  <div>
    <strong>Other</strong>
    {selectedResolutionQty === 'other' && (
      <InputNumber 
        style={{marginLeft: 12, width: 150}}
        value={customResolutionQty}
        onChange={setCustomResolutionQty}
        placeholder="Enter quantity"
      />
    )}
  </div>
</label>
```

---

### Modal 2: Quantity Variance Resolution
```typescript
<Modal
  className="quantity-variance-resolution-modal"
  title={<div className="resolution-modal-title"><span>Quantity Variance Resolution</span><Tag color="processing">Quantity Variance</Tag></div>}
  open={quantityVarianceResolutionOpen}
  onCancel={() => setQuantityVarianceResolutionOpen(false)}
  width={700}
  footer={[
    <Button key="cancel" onClick={() => setQuantityVarianceResolutionOpen(false)}>Cancel</Button>,
    <Button key="ok" type="primary" onClick={() => {
      setQuantityVarianceResolutionOpen(false);
      messageApi.success('Quantity resolution applied');
    }}>
      OK
    </Button>,
  ]}
>
  <div className="resolution-modal-content">
    <div className="resolution-section">
      <h4>Quantity Variance Resolution</h4>
      <div className="resolution-fields">
        <label className="resolution-field">
          <span>Reason ID</span>
          <Input placeholder="Enter reason ID or select from list" />
        </label>
        <label className="resolution-field">
          <span>Comment</span>
          <Input.TextArea 
            rows={3}
            placeholder="Add comments about this resolution"
          />
        </label>
        <label className="resolution-field">
          <span>Re-route to Group (Optional)</span>
          <Input placeholder="Enter group ID or select from list" />
        </label>
        <Button type="primary" style={{marginTop: 8}}>Apply Resolution</Button>
      </div>
    </div>
  </div>
</Modal>
```

**Features:**
- Collects variance documentation
- Reason ID field for tracking
- Comments field for notes (no amount needed for quantity)
- Optional re-routing field
- OK button closes modal and shows success message

---

## Summary of Changes

| Aspect | Added | Removed | Modified |
|--------|-------|---------|----------|
| State Variables | 8 new states | 18 unused states | - |
| Helper Functions | 3 new functions | - | - |
| UI Components | 4 modals + 2 buttons | - | Receipt selection area |
| State Management | Receipt-linked variance | Old form fields | - |
| Modal Modals | 2-step flow system | Inline forms | - |

---

## Key Implementation Decisions

### 1. Receipt Linking First
- All variance checks depend on receipt selection
- Prevents false positives or showing options when receipt is not selected

### 2. Two-Step Modal Flow
- Step 1: Clear choice (invoice/receipt/custom)
- Step 2: Document the decision (reason, comment)
- Separation of concerns makes flow clearer

### 3. Helper Functions Pattern
- `hasCostVariance()`, `hasQuantityVariance()`, `getSelectedReceipt()`
- Centralizes complex logic
- Makes conditions more readable
- Easier to maintain and test

### 4. Conditional Rendering
- Buttons only show when receipt selected AND variance exists
- Uses logical AND (&&) operator for clear intent
- No empty space when no variances exist

### 5. Custom Input Support
- Users can override both cost and quantity
- "Other" option provides flexibility
- InputNumber components validate input

---

## Testing the Implementation

### Build Verification
```bash
npm run build
# Should complete with no TypeScript errors
```

### Dev Server
```bash
npm run dev
# App runs at http://localhost:5173/
```

### Manual Testing
1. Select invoice "IM-0891" (has both variances)
2. Select receipt "RCP-722140"
3. Verify both buttons are enabled
4. Click "Cost Resolution"
5. Select "Receipt Cost" and click Next
6. Fill form and click OK
7. Verify success message appears
8. Repeat for "Qty Resolution"

---

## Performance Considerations

### Variance Detection
- Runs on every receipt selection change
- O(n) complexity where n = number of lines
- Acceptable for invoices with <100 lines

### Modal Rendering
- Modals only render when `open={true}`
- Custom inputs only render when option selected
- No performance impact on normal invoice viewing

### State Updates
- Only relevant state updates on receipt change
- React's re-render optimization prevents unnecessary updates
- No extra API calls or network requests

---

## Browser Compatibility

- Works on all modern browsers (Chrome, Firefox, Safari, Edge)
- Uses standard React hooks (useState)
- Ant Design components ensure compatibility
- No experimental features used

---

## Accessibility Features

- Radio buttons are semantic HTML
- Labels are properly associated with inputs
- Modal titles are clear and descriptive
- Button text is descriptive ("Cost Resolution" vs "Resolve")
- Cancel buttons provide exit routes

---

## Future Enhancements

Potential improvements for future releases:

1. **Reason ID Dropdown**: Replace text input with dropdown of predefined reasons
2. **Amount Calculation**: Auto-calculate discrepancy when selecting receipt cost
3. **Workflow Integration**: Connect OK button to backend API for saving
4. **Validation**: Add field validation before allowing Next/OK
5. **History**: Show previous resolutions for same invoice
6. **Batch Operations**: Resolve multiple invoices at once
7. **Audit Trail**: Store resolution history with timestamps and user info
8. **Template Reasons**: Suggest common variance reasons based on pattern

