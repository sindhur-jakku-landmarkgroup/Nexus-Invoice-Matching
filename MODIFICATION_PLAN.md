# Prototype Modification Plan - AP Executive Review Implementation

**Status**: READY FOR IMPLEMENTATION  
**Date**: November 12, 2026  
**Based on**: AP Executive Review - Invoice Matching Modernization v1.0

---

## Executive Summary

This document outlines the modifications needed to bring the invoice matching prototype into alignment with the AP Executive Review recommendations. These are **Phase 1 Critical** modifications that must be completed before production rollout.

---

## Modification 1: Tolerance Visibility

### Current State
- Variance detection shows only invoice vs receipt values
- No tolerance limits displayed
- No percentage variance calculations
- Users don't know if variance is acceptable or requires escalation

### Required Changes
**Location**: Variance summary section (below cumulative totals)

**Add tolerance display box showing:**
```
Tolerance Settings (Standard)
├─ Quantity Tolerance: ±2% (16.8 units for 840-unit order)
├─ Cost Tolerance: ±1% (AED 157.80 for AED 15,780 order)
├─ Current Variance:
│  ├─ Quantity: 5 units (0.6%) ✓ Within tolerance
│  └─ Cost: AED 250 (1.6%) ✗ Exceeds tolerance
└─ Status: Requires Manager Review
```

### Implementation Details
- Extract tolerance settings from invoice data (quantityTolerance, costTolerance properties)
- Calculate percentage variance: (variance / invoice_amount) * 100
- Add conditional styling:
  - **Green** (✓) if within tolerance
  - **Red** (✗) if exceeds tolerance
  - **Yellow** (⚠) if at edge of tolerance
- Display in clear, scannable format

### Affected Components
- State: Add `tolerancePercentage` constants or config
- Render: Variance detection box
- Styling: New `.tolerance-display` CSS class

---

## Modification 2: Enhanced Cumulative Display with Status

### Current State
- Shows "Total Qty" and "Total Cost" when invoices/receipts selected
- No status indicator
- No variance summary
- Doesn't indicate if match is ready or needs action

### Required Changes
**Location**: Below cumulative totals in invoice/receipt sections

**Add matching status badge:**
```
Status: Perfect Match ✓
├─ All selected quantities match exactly
├─ All selected costs match exactly
└─ Ready to confirm - No resolution needed
```

**OR for variance cases:**
```
Status: Requires Resolution ⚠
├─ Quantity variance: 5 units (within 2% tolerance)
├─ Cost variance: AED 250 (exceeds 1% tolerance) ✗
└─ Action: Escalate to manager or resolve discrepancy
```

### Implementation Details
- Calculate if cumulative totals match perfectly
- Check both quantity and cost
- Color code status:
  - **Green** (✓) = Perfect Match - Confirm enabled
  - **Yellow** (⚠) = Within Tolerance - Resolve or Confirm enabled
  - **Red** (✗) = Exceeds Tolerance - Escalate required, Confirm disabled
- Position status badge above or alongside cumulative totals

### Affected Components
- New function: `getMatchStatus(order, invoiceIds, receiptIds)` 
- New function: `getStatusColor(status)`
- Render: Status badge component
- Styling: New `.match-status-badge` CSS classes

---

## Modification 3: Manager Escalation Workflow

### Current State
- "Resolve Discrepancy" button opens modal for users to handle variance
- No escalation mechanism for out-of-tolerance cases
- No manager queue or approval workflow
- Users must manually defer or apply incorrect values

### Required Changes
**Location**: Action buttons (same row as "Resolve Discrepancy" and "Confirm Match")

**Add new "Escalate to Manager" button:**
- Appears only when variance exceeds tolerance limits
- Opens escalation modal with:
  - Auto-filled issue summary
  - Reason code dropdown
  - Comment/notes field
  - Manager assignment (dropdown or auto-assigned)
  - SLA timer (target resolution time)

**Escalation modal fields:**
```
┌─ Escalation to Manager ──────────────────────────┐
│                                                   │
│ Order #6502391                                   │
│ Invoice: INV-260381 · AED 48,216.40              │
│ Issue: Cost variance exceeds tolerance           │
│                                                   │
│ Reason Code *: [Dropdown]                        │
│   - Pricing error                                │
│   - Shortage (partial receipt)                   │
│   - Overcharge by vendor                         │
│   - Tax discrepancy                              │
│   - Freight charge variation                     │
│   - Other (please specify)                       │
│                                                   │
│ Comment/Notes *:                                 │
│ [Text area - required for escalation]            │
│                                                   │
│ Assign to Manager:                               │
│ [Current user's manager - pre-populated]         │
│                                                   │
│ [Cancel] [Escalate]                              │
└─────────────────────────────────────────────────┘
```

### Implementation Details
- New state variables:
  - `escalationOpen: boolean`
  - `escalationReason: string`
  - `escalationComment: string`
  - `assignedManager: string`
  - `escalations: Map<OrderNo, {status, assignedTo, date, reason}>`
- New handler: `handleEscalateToManager()`
- Update invoice state to track escalation status
- Add to order card: escalation status badge when escalated
- Records timestamp and user who escalated

### Affected Components
- New Modal: Escalation modal component
- New Button: "Escalate to Manager" button
- New State: escalation tracking
- New CSS: `.escalation-modal`, `.escalation-button`, `.escalation-status-badge`

---

## Modification 4: Improved Variance Display Format

### Current State
```
Variance Detected
Cost: AED 48,216.40 (invoice) ≠ AED 23,872.00 (receipt)
```

### Required Changes
**Make variance display more scannable and actionable:**

```
┌─ Variance Analysis ──────────────────────────────┐
│                                                  │
│ Quantity Variance:                              │
│ Invoice: 320 units                              │
│ Receipt:  315 units (selected)                  │
│ Difference: 5 units (1.6%) ✓ Within 2% tolerance│
│                                                  │
│ Cost Variance:                                   │
│ Invoice: AED 48,216.40                          │
│ Receipt: AED 47,856.00 (selected total)        │
│ Difference: AED 360.40 (0.7%) ✓ Within 1% tolerance│
│                                                  │
│ Overall Status: ✓ Ready to match                │
└──────────────────────────────────────────────────┘
```

### Implementation Details
- Better data structure for variance comparison
- Calculate and display percentages
- Color coding for each line
- Summary status at bottom
- Auto-update when selections change

### Affected Components
- New function: `calculateVariancePercentage(value, base)`
- Enhanced render of variance display
- New CSS: `.variance-analysis`, `.variance-line`, `.variance-summary`

---

## Implementation Priority

### Phase 1a (Weeks 1-2) - CRITICAL
1. ✅ Tolerance Visibility - Show tolerance limits and current variance percentages
2. ✅ Enhanced Status Badge - Display match status (Perfect/Requires Review/Escalate)
3. ✅ Improved Variance Format - Better readability of quantity and cost variance

### Phase 1b (Week 3) - REQUIRED  
4. ✅ Manager Escalation - Add escalation workflow for out-of-tolerance cases

### Phase 2 (Weeks 4-6) - ENHANCEMENT
- Escalation queue for managers
- Approval/rejection workflow
- Escalation history and audit trail
- Performance metrics dashboard

---

## Technical Implementation Guidelines

### State Variables to Add
```typescript
// Tolerance configuration
const STANDARD_QUANTITY_TOLERANCE = 0.02; // 2%
const STANDARD_COST_TOLERANCE = 0.01;     // 1%

// Escalation tracking
const [escalations, setEscalations] = useState<Map<string, Escalation>>(new Map());
const [escalationOpen, setEscalationOpen] = useState(false);
const [escalationOrderNo, setEscalationOrderNo] = useState<string>('');
const [escalationReason, setEscalationReason] = useState<string>('');
const [escalationComment, setEscalationComment] = useState<string>('');
```

### Helper Functions to Add
```typescript
// Calculate variance percentage
const getVariancePercentage = (variance: number, baseAmount: number): number => {
  return (Math.abs(variance) / baseAmount) * 100;
};

// Determine if variance exceeds tolerance
const exceedsQuantityTolerance = (variance: number, invoiceQty: number): boolean => {
  return getVariancePercentage(variance, invoiceQty) > STANDARD_QUANTITY_TOLERANCE * 100;
};

const exceedsCostTolerance = (variance: number, invoiceCost: number): boolean => {
  return getVariancePercentage(variance, invoiceCost) > STANDARD_COST_TOLERANCE * 100;
};

// Get match status
const getMatchStatus = (order): 'perfect' | 'requires-resolution' | 'exceeds-tolerance' => {
  const qtyVariance = /* calculate */;
  const costVariance = /* calculate */;
  if (qtyVariance === 0 && costVariance === 0) return 'perfect';
  if (!exceedsQuantityTolerance(qtyVariance, 0) && !exceedsCostTolerance(costVariance, 0)) return 'requires-resolution';
  return 'exceeds-tolerance';
};
```

### CSS Classes to Add
```css
.tolerance-display {
  padding: 12px;
  background: #f5f7fa;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 12px;
}

.tolerance-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.tolerance-label {
  color: #666;
  font-weight: 500;
}

.tolerance-value {
  color: #333;
  font-weight: 600;
}

.tolerance-status-ok {
  color: #52c41a;
}

.tolerance-status-error {
  color: #ff4d4f;
}

.match-status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 4px;
  font-weight: 600;
  margin-bottom: 12px;
  font-size: 12px;
}

.match-status-perfect {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #389e0d;
}

.match-status-review {
  background: #fffbe6;
  border: 1px solid #ffe58f;
  color: #ad6800;
}

.match-status-escalate {
  background: #fff1f0;
  border: 1px solid #ffa39e;
  color: #d9363e;
}

.escalation-button {
  background: #ff4d4f;
  border-color: #ff4d4f;
  color: #fff;
}

.escalation-button:hover {
  background: #d9363e;
  border-color: #d9363e;
}
```

---

## Testing Strategy

### Unit Testing
1. Variance percentage calculations
2. Tolerance comparison logic
3. Match status determination
4. Escalation state management

### Integration Testing
1. Variance display updates when selections change
2. Escalation modal opens only for exceeding tolerance
3. Escalation saves correctly to state
4. Status badges update in real-time

### User Acceptance Testing
1. Tolerance visibility clear to AP users
2. Status badges match expectations
3. Escalation workflow intuitive
4. All edge cases handled (single receipt, multiple receipts, credit notes)

---

## Rollback Plan

If issues are discovered after implementation:

1. **Minor issues**: Use feature flags to disable specific components
2. **Critical issues**: Revert to previous commit (git revert)
3. **Data issues**: Escalation data is separate - can be cleared without affecting matching

---

## Documentation Updates

After implementation, update:

1. **User_Workflow_Guide.md** - Add tolerance display explanation
2. **IMPLEMENTATION_SUMMARY.md** - Document new features
3. **In-app help/tooltips** - Explain tolerance and escalation

---

## Success Criteria

- ✅ All tolerance limits visible to users on every order card
- ✅ Variance percentages calculated and displayed correctly
- ✅ Match status badge shows appropriate status (Perfect/Review/Escalate)
- ✅ Escalation button appears only for exceeding tolerance
- ✅ Escalation modal captures required information
- ✅ No console errors or TypeScript compilation issues
- ✅ Performance not degraded (page load < 2 seconds)
- ✅ Responsive on mobile (variance display stacks appropriately)
- ✅ All color/contrast meets accessibility standards

---

## Implementation Timeline

- **Day 1-2**: Code tolerance and status badge logic
- **Day 2-3**: Implement variance display improvements  
- **Day 3-4**: Build escalation modal and workflow
- **Day 4**: Testing and bug fixes
- **Day 5**: Documentation and demo preparation

**Total**: 1 week to complete all Phase 1a and 1b modifications

---

## Next Steps

1. Review this plan with development team
2. Assign developer(s) to each modification
3. Create git branch: `feature/phase1-tolerance-escalation`
4. Begin implementation following priority order
5. Daily standups to track progress
6. Testing and UAT with AP team before merge

---

**Prepared by**: Application Review Team  
**Approved by**: [AP Leadership]  
**Last Updated**: November 12, 2026
