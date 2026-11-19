# Receipt-Linked Cost and Quantity Resolution Windows
## User Guide & Feature Documentation

---

## Overview
The ReIM prototype now includes receipt-linked Cost and Quantity Resolution windows that enable users to resolve invoice variances against selected receipts.

---

## Key Features

### 🔗 Receipt Linking
- **Cost Resolution button** only works after:
  - ✓ A receipt is selected from the radio button group
  - ✓ A cost variance is detected (invoice unitCost ≠ receipt unitCost)

- **Qty Resolution button** only works after:
  - ✓ A receipt is selected from the radio button group  
  - ✓ A quantity variance is detected (invoice invoiceQty ≠ receipt quantity)

### 🔍 Automatic Variance Detection
The system automatically detects:
- **Cost Variance**: Compares invoice unit cost with receipt unit cost (receipt.amount ÷ receipt.quantity)
- **Quantity Variance**: Compares invoice quantity with receipt quantity
- Variance detection runs every time the receipt selection changes

### 🎯 Two-Step Resolution Flow
Each resolution follows a consistent 2-step flow:
1. **Step 1 - Selection Modal**: Choose invoice, receipt, or enter custom value
2. **Step 2 - Variance Modal**: Enter reason, amount/comment, and optional re-routing

---

## User Workflow

### Step 1: Select an Invoice
Navigate to the matching workbench and select an invoice from the queue.

### Step 2: Select a Receipt
In the Receipt Selection section, click the radio button to select a receipt from available options.

Example receipt options:
```
○ RCP-723842  |  Dubai DC · 09 Nov 2026  |  320 units · AED 23,872
● RCP-724091  |  Dubai DC · 10 Nov 2026  |  325 units · AED 24,244.40  [SELECTED]
```

### Step 3: Buttons Appear (if variance exists)
After selecting a receipt, check for variance. If detected, resolution buttons appear:

**If cost variance exists:**
- "Cost Resolution" button appears and is **enabled**

**If quantity variance exists:**
- "Qty Resolution" button appears and is **enabled**

**If no variance:**
- No resolution buttons appear
- Proceed directly to "Confirm match"

### Step 4a: Cost Resolution (if cost variance detected)

#### Cost Selection Modal
Shows two options to choose from:
```
○ Invoice Cost       AED 74.60
● Receipt Cost       AED 74.44
○ Other            [Input field for custom amount]
```
Select the correct cost and click **Next**

#### Cost Variance Resolution Modal
Complete the variance documentation:
- **Reason ID**: Enter code or description (required)
- **Amount**: Enter the discrepancy amount (required)
- **Comments**: Add notes about this resolution
- **Re-route to Group**: Optional, leave blank if not needed

Click **OK** to apply

### Step 4b: Quantity Resolution (if quantity variance detected)

#### Quantity Selection Modal
Shows two options to choose from:
```
○ Invoice Quantity   100 units
● Receipt Quantity   98 units
○ Other            [Input field for custom quantity]
```
Select the correct quantity and click **Next**

#### Quantity Variance Resolution Modal
Complete the variance documentation:
- **Reason ID**: Enter code or description (required)
- **Comment**: Add notes about this resolution
- **Re-route to Group**: Optional, leave blank if not needed

Click **OK** to apply

### Step 5: Confirm Match
After resolving variances, click **Confirm match** to complete the invoice matching process.

---

## Example Scenarios

### Scenario 1: Both Cost and Quantity Variance
**Invoice**: IM-0891 (Northstar Home Trading)
- Invoice: 105 units @ AED 50/unit
- Receipt: 100 units @ AED 48/unit

**User Actions**:
1. Select receipt "RCP-722140"
2. See both buttons enabled (cost AND quantity variances)
3. First, resolve cost: Click "Cost Resolution"
   - Select "Receipt Cost" (AED 48)
   - Enter reason: "PRICE_VARIANCE"
   - Enter amount: 2.00
   - Click OK
4. Then, resolve quantity: Click "Qty Resolution"
   - Select "Receipt Quantity" (100 units)
   - Enter reason: "SHORT_DELIVERY"
   - Click OK
5. Click "Confirm match" to complete

### Scenario 2: Only Quantity Variance
**Invoice**: IM-1021 (Emirates Textile House)
- Invoice: 100 units @ AED 126.54/unit
- Receipt: 98 units @ AED 126.54/unit

**User Actions**:
1. Select receipt "RCP-722988"
2. See only "Qty Resolution" button enabled (cost matches)
3. Click "Qty Resolution"
   - Select "Receipt Quantity" (98 units)
   - Enter reason: "SHORT_DELIVERY"
   - Click OK
4. Click "Confirm match"

### Scenario 3: No Variance Detected
**Invoice**: IM-1042 (Al Noor Home Centre)
- Invoice: 320 units @ AED 74.60/unit
- Receipt: 320 units @ AED 74.60/unit

**User Actions**:
1. Select receipt "RCP-723842"
2. No resolution buttons appear (perfect match)
3. Directly click "Confirm match"

---

## Button States

### Cost Resolution Button

| State | Condition | Display |
|-------|-----------|---------|
| **Enabled** | Receipt selected ✓ + Cost variance ✓ | Blue, clickable |
| **Disabled** | No receipt selected | Grayed out |
| **Disabled** | Receipt selected but no cost variance | Grayed out |
| **Hidden** | Invoice section not matching view | Not shown |

### Qty Resolution Button

| State | Condition | Display |
|-------|-----------|---------|
| **Enabled** | Receipt selected ✓ + Qty variance ✓ | Blue, clickable |
| **Disabled** | No receipt selected | Grayed out |
| **Disabled** | Receipt selected but no qty variance | Grayed out |
| **Hidden** | Invoice section not matching view | Not shown |

---

## Technical Details

### Cost Variance Calculation
```
receiptUnitCost = receipt.amount ÷ receipt.quantity
costVariance = (invoiceUnitCost !== receiptUnitCost)
```

### Quantity Variance Calculation
```
quantityVariance = (invoiceQty !== receiptQuantity)
```

### Helper Functions

#### `hasCostVariance()`
- **Returns**: boolean
- **Logic**: Compares invoice unitCost with calculated receipt unitCost
- **Used by**: Cost Resolution button disable logic

#### `hasQuantityVariance()`
- **Returns**: boolean
- **Logic**: Compares invoice invoiceQty with receipt quantity
- **Used by**: Qty Resolution button disable logic

#### `getSelectedReceipt()`
- **Returns**: Receipt object or null
- **Logic**: Retrieves the currently selected receipt
- **Used by**: Modal content rendering

---

## Implementation Notes

### Receipt-Linked Design
- All variance detection depends on receipt selection
- Changing receipt selection automatically updates button states
- No explicit refresh needed; UI updates reactively

### Two-Step Modal Flow
- **Step 1**: User selects which value to use (invoice/receipt/custom)
- **Step 2**: User documents the resolution with reason and comments
- Separation allows clear decision-making and audit trail

### Re-routing (Optional)
- Users can optionally re-route variance resolutions to other groups
- Leave blank if no re-routing needed
- Useful for escalations or special handling

### Success Messaging
- After applying resolution: "Cost resolution applied" or "Quantity resolution applied"
- Provides user confirmation that action was recorded

---

## Frequently Asked Questions

**Q: Why is the Cost Resolution button disabled?**
A: Either (1) no receipt is selected, or (2) the selected receipt has the same unit cost as the invoice.

**Q: What does "Receipt Cost" mean?**
A: The calculated unit cost from the receipt = (receipt total amount) ÷ (receipt quantity)

**Q: Can I enter a custom cost/quantity?**
A: Yes! Select "Other" in the selection modal and enter your custom value.

**Q: What if there's no variance?**
A: The resolution buttons won't appear. You can directly click "Confirm match" to proceed.

**Q: Is re-routing mandatory?**
A: No, it's optional. Leave it blank if you don't need to re-route the variance.

**Q: Can I go back and change my selection?**
A: Yes, both modals have Cancel buttons. Go back, select a different receipt, and start over.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Buttons not appearing | Check if receipt is selected and variance exists |
| Can't click Cost Resolution | Verify cost variance exists (compare invoice vs receipt unit cost) |
| Can't click Qty Resolution | Verify qty variance exists (compare invoice qty vs receipt qty) |
| Modal won't open | Try refreshing the page or reselecting the invoice |
| Custom input not working | Ensure you selected "Other" option first |

---

## Summary

The receipt-linked resolution windows provide a clean, guided workflow for handling invoice variances. By linking everything to receipt selection and automatic variance detection, the system ensures users only see resolution options when they're truly needed.

**Benefits:**
✓ Clear, single-purpose buttons
✓ Automatic variance detection
✓ Guided two-step workflow
✓ Audit trail with reason and comments
✓ Optional variance re-routing
✓ Intuitive, responsive UI
