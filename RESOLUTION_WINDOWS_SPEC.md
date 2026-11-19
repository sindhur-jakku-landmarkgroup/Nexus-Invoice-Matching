# Cost and Quantity Resolution Windows Implementation Guide

## Overview
Add two missing resolution modals to align the ReIM prototype with the legacy RIM application's discrepancy resolution workflows.

## Reference: User Guide (reim-121-ug.pdf, Pages 61-62)

### Cost Resolution Workflow
**Pages 61-62:** "Resolve Cost Discrepancies"

**Flow:**
1. User clicks "Cost Resolution" button in matching details
2. **Cost Selection Window** opens:
   - Display item details being reviewed
   - Show three cost options to select from:
     - Order cost
     - Invoice cost
     - Other (with input field for custom amount)
   - "Next" button proceeds to variance resolution

3. **Cost Variance Resolution Window** opens:
   - "Apply" section with:
     - Reason ID field (with LOV button for lookup)
     - Amount field (monetary discrepancy amount)
     - Comments text area
     - Re-route to Group field (with LOV button)
   - "Resolution" section showing applied resolutions
   - Delete option to remove resolutions
   - OK button to save and close

### Quantity Resolution Workflow
**Pages 62-63:** "Resolve Quantity Discrepancies"

**Flow:**
1. User clicks "Qty Resolution" button in matching details
2. **Quantity Selection Window** opens:
   - Display item details
   - Show quantity options:
     - Order quantity
     - Invoice quantity
     - Other (with input field)
   - "Next" button proceeds to variance resolution

3. **Quantity Variance Resolution Window** opens:
   - Same structure as Cost Variance:
     - Reason ID field (with LOV)
     - Comment field
     - Re-route to Group field (with LOV)
   - Applied resolutions list
   - Delete option
   - OK button

## Implementation Requirements

### Key Behavior: Receipt-Linked Resolution
- **CRITICAL:** Resolution buttons are ONLY enabled after user selects a receipt
- Once receipt is selected, compare invoice data with selected receipt data
- Check for quantity variance: `invoice.lines[].invoiceQty !== receipt.quantity`
- Check for cost variance: `invoice.lines[].unitCost !== receipt.unitCost`
- Enable buttons only if variances are detected

### State Management
```typescript
interface ResolutionState {
  costResolutionOpen: boolean;
  quantityResolutionOpen: boolean;
  costVarianceResolutionOpen: boolean;
  quantityVarianceResolutionOpen: boolean;
  selectedCost?: 'order' | 'invoice' | 'other';
  customCostAmount?: number;
  selectedQuantity?: 'order' | 'invoice' | 'other';
  customQuantityAmount?: number;
  resolutions: Resolution[];
}

interface Resolution {
  id: string;
  type: 'cost' | 'quantity';
  reasonId: string;
  amount: number;
  comment: string;
  rerouteGroup?: string;
  appliedAt: string;
}
```

### UI Components Needed
1. **Action Buttons in Matching Details** (located in Receipt Selection area)
   - "Cost Resolution" button - **DISABLED** until receipt selected AND cost variance detected
   - "Qty Resolution" button - **DISABLED** until receipt selected AND quantity variance detected
   - Show adjacent to or below receipt selection radio buttons

2. **Cost Selection Modal** (triggered by Cost Resolution button)
   - Display invoice cost vs selected receipt cost
   - Radio buttons for cost options (Invoice cost, Receipt cost, Other)
   - InputNumber for "Other" value
   - Next button to open Cost Variance Resolution

3. **Cost Variance Resolution Modal**
   - Form with Reason ID, Amount, Comments, Re-route Group
   - Apply button
   - Applied resolutions list
   - Delete buttons per resolution

4. **Quantity Selection Modal** (triggered by Qty Resolution button)
   - Display invoice quantity vs selected receipt quantity
   - Radio buttons for quantity options (Invoice qty, Receipt qty, Other)
   - InputNumber for "Other" value
   - Next button to open Quantity Variance Resolution

5. **Quantity Variance Resolution Modal**
   - Same form structure as cost variance
   - Apply button
   - Applied resolutions list
   - Delete buttons

### Button Enable Logic
```
Cost Resolution Button ENABLED = 
  selectedReceipt !== null 
  AND invoice.lines.some(line => line.unitCost !== selectedReceipt.unitCost)

Qty Resolution Button ENABLED = 
  selectedReceipt !== null 
  AND invoice.lines.some(line => line.invoiceQty !== selectedReceipt.quantity)
```

### Styling Notes
- Match existing Ant Design theme
- Use Modal component consistent with other modals
- Form styling aligned with invoice maintenance modal
- Button sizing: height: 34px, font-size: 12px (per prototype standards)
- Spacing: 12px gaps between sections

### Test Cases
- [ ] Cost resolution modal opens/closes correctly
- [ ] Quantity resolution modal opens/closes correctly
- [ ] Form fields accept input
- [ ] Resolutions can be applied and displayed
- [ ] Resolutions can be deleted
- [ ] Buttons only show when variances exist
- [ ] Modal data persists when switching tabs
- [ ] Works with multiple line items

## Files to Modify
- `src/App.tsx` - Add state, handlers, and modal components
- `src/styles.css` - Add modal styling if needed

## Integration Points
- Wire resolutions to invoice object so they persist
- Display resolution summary in activity tab
- Prevent match confirmation until resolutions are addressed (if configured)
