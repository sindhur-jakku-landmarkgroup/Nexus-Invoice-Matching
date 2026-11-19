# Quick Reference: Receipt-Linked Resolution Windows

## Feature Summary
Receipt-linked Cost and Quantity Resolution windows that only enable when a receipt is selected AND a variance is detected.

---

## When Buttons Appear

### Cost Resolution Button
**Appears when:**
- ✓ Receipt selected
- ✓ Cost variance exists (invoice unitCost ≠ receipt unitCost)

**Disappears when:**
- ✗ No receipt selected
- ✗ No cost variance (prices match)

### Qty Resolution Button
**Appears when:**
- ✓ Receipt selected
- ✓ Quantity variance exists (invoice qty ≠ receipt qty)

**Disappears when:**
- ✗ No receipt selected
- ✗ No quantity variance (quantities match)

---

## Button States

```
┌─────────────────────────────────────┐
│  ENABLED (Blue, Clickable)          │
│  When receipt selected +             │
│  specific variance detected          │
└─────────────────────────────────────┘
         ↓ Click → Opens Modal

┌─────────────────────────────────────┐
│  DISABLED (Grayed Out)              │
│  When receipt not selected OR        │
│  no variance detected               │
└─────────────────────────────────────┘
         ↓ No Action
```

---

## Cost Resolution Flow

```
1. SELECT RECEIPT
   ↓
2. CLICK "Cost Resolution" (if enabled)
   ↓
3. COST SELECTION MODAL
   ├─ Invoice Cost: AED 74.60
   ├─ Receipt Cost: AED 74.44
   └─ Other: [Custom input]
   ↓ Click "Next"
   ↓
4. COST VARIANCE RESOLUTION MODAL
   ├─ Reason ID: [Text input]
   ├─ Amount: [Numeric input]
   ├─ Comments: [Text area]
   └─ Re-route Group: [Text input - Optional]
   ↓ Click "OK"
   ↓
5. SUCCESS MESSAGE
   "Cost resolution applied"
```

---

## Quantity Resolution Flow

```
1. SELECT RECEIPT
   ↓
2. CLICK "Qty Resolution" (if enabled)
   ↓
3. QUANTITY SELECTION MODAL
   ├─ Invoice Quantity: 100 units
   ├─ Receipt Quantity: 98 units
   └─ Other: [Custom input]
   ↓ Click "Next"
   ↓
4. QUANTITY VARIANCE RESOLUTION MODAL
   ├─ Reason ID: [Text input]
   ├─ Comment: [Text area]
   └─ Re-route Group: [Text input - Optional]
   ↓ Click "OK"
   ↓
5. SUCCESS MESSAGE
   "Quantity resolution applied"
```

---

## Key Terms

| Term | Meaning |
|------|---------|
| **Receipt** | Physical delivery record with actual qty & amount received |
| **Invoice** | Supplier billing document with ordered qty & unit cost |
| **Variance** | Difference between invoice and receipt (qty or cost mismatch) |
| **Receipt-Linked** | Buttons only work when receipt is selected |
| **Unit Cost** | Price per item (calculated as receipt amount ÷ quantity) |

---

## Examples

### Example 1: Cost Variance
```
Invoice: 100 units @ AED 50.00 = AED 5,000
Receipt: 100 units @ AED 48.00 = AED 4,800
Variance: AED 2.00 per unit

→ "Cost Resolution" button ENABLED
→ "Qty Resolution" button NOT shown (qty matches)
```

### Example 2: Quantity Variance
```
Invoice: 105 units @ AED 50.00 = AED 5,250
Receipt: 100 units @ AED 50.00 = AED 5,000
Variance: 5 units short

→ "Qty Resolution" button ENABLED
→ "Cost Resolution" button NOT shown (cost matches)
```

### Example 3: Both Variances
```
Invoice: 105 units @ AED 50.00 = AED 5,250
Receipt: 100 units @ AED 48.00 = AED 4,800
Variances: 5 units + AED 2.00/unit

→ Both buttons ENABLED
→ Resolve cost first, then quantity (or vice versa)
```

### Example 4: No Variance
```
Invoice: 100 units @ AED 50.00 = AED 5,000
Receipt: 100 units @ AED 50.00 = AED 5,000
Variance: NONE

→ Neither button shown (perfect match)
→ Click "Confirm match" to proceed
```

---

## Variance Detection Logic

### Cost Variance
```typescript
receiptUnitCost = receipt.amount ÷ receipt.quantity
hasCostVariance = (invoice.unitCost ≠ receiptUnitCost)
```

### Quantity Variance
```typescript
hasQuantityVariance = (invoice.invoiceQty ≠ receipt.quantity)
```

---

## Navigation Tips

| Action | Result |
|--------|--------|
| Select different receipt | Buttons update automatically |
| Click "Cancel" in modal | Return to receipt selection, no changes saved |
| Click "Next" in Step 1 | Proceed to Step 2 variance modal |
| Click "OK" in Step 2 | Apply resolution, close modal |
| Click "Cost Resolution" | Opens Cost Selection modal (Step 1) |
| Click "Qty Resolution" | Opens Quantity Selection modal (Step 1) |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Buttons not visible | Select a receipt first |
| Cost Resolution disabled | Check if cost matches (no variance) |
| Qty Resolution disabled | Check if qty matches (no variance) |
| Modal won't open | Try refreshing the page |
| Can't enter custom value | Make sure "Other" option is selected |
| Changes not saved | Click "OK" to save, not "Cancel" |

---

## Form Fields Reference

### Cost Variance Resolution
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Reason ID | Text | Yes | Enter code or description |
| Amount | Number | Yes | Discrepancy amount |
| Comments | Text | No | Optional notes |
| Re-route Group | Text | No | Optional group ID |

### Quantity Variance Resolution
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Reason ID | Text | Yes | Enter code or description |
| Comment | Text | No | Optional notes |
| Re-route Group | Text | No | Optional group ID |

---

## State Flow Diagram

```
┌──────────────────────────────────────┐
│  No Receipt Selected                 │
│  NO buttons shown                    │
└──────────────────────────────────────┘
         ↓ Select Receipt
         ↓
┌──────────────────────────────────────┐
│  Receipt Selected                    │
│  Check for variances...              │
└──────────────────────────────────────┘
         ↙          ↘
        /            \
       /              \
      /                \
     ↓                  ↓
┌─────────┐        ┌──────────┐
│ Cost    │        │ Qty      │
│Variance │        │Variance  │
│ Found   │        │ Found    │
└─────────┘        └──────────┘
    ↓                  ↓
Show "Cost"        Show "Qty"
Resolution         Resolution
Button             Button
```

---

## Success Indicators

✓ Receipt selected (radio button filled)  
✓ Variance buttons appear  
✓ Button colors change to blue (enabled)  
✓ Modal opens when button clicked  
✓ Modal displays correct receipt data  
✓ Success message appears after OK  

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Navigate between form fields |
| Enter | Submit form (if focused on button) |
| Escape | Close modal (same as Cancel) |
| Space | Select radio button option |

---

## Mobile View

- Buttons stack vertically on smaller screens
- Modal width adapts to screen size
- Radio buttons are touch-friendly
- Input fields have appropriate touch targets

---

## Accessibility

- ♿ All labels associated with inputs
- ♿ Keyboard navigation fully supported
- ♿ Screen reader compatible
- ♿ High contrast for readability
- ♿ Clear focus indicators

---

## Related Documentation

📄 **IMPLEMENTATION_SUMMARY.md** - Technical implementation details  
📄 **FEATURE_GUIDE.md** - Comprehensive user guide with scenarios  
📄 **CODE_CHANGES.md** - Detailed code explanation  
📄 **VERIFICATION_REPORT.md** - QA verification and test results  

---

**Last Updated**: November 11, 2026  
**Status**: ✅ Production Ready  
**Version**: 1.0
