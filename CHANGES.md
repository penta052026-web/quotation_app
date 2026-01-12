# Changes Summary - PQ Number Format and Discount Fix

## Date
December 3, 2025

## Issues Fixed

### 1. PQ Number Format (PQYYMMNNNN)
**Problem:** The system was auto-generating PQ numbers instead of allowing manual entry, and revisions weren't automatically appending `-REV1`, `-REV2`, etc.

**Solution:**
- **New Quotations:** Users now manually enter the PQ number in format `PQYYMMNNNN` (e.g., `PQ25121234`)
  - Format validation: `PQ` + 2-digit year + 2-digit month + 4-digit sequence number
  - Example: `PQ25121234` means Year 2025, December, sequence 1234

- **Edit Mode (Revisions):** When editing an existing quotation:
  - The system automatically appends revision numbers
  - `PQ25121234` → `PQ25121234-REV1` (first revision)
  - `PQ25121234-REV1` → `PQ25121234-REV2` (second revision)
  - Pattern continues: `-REV3`, `-REV4`, etc.

**Files Modified:**
- `frontend/quotation-frontend/src/app/components/quotation-form/quotation-form.ts`
  - Removed auto-generation of PQ numbers in `ngOnInit()` (line 71-95)
  - Updated comments to clarify manual entry requirement

### 2. Discount Not Populating in Edit Mode
**Problem:** When editing a quotation, the discount percentage field was not being populated correctly.

**Root Cause:** The discount percentage and amount were not being stored in the database, requiring reverse-engineering from subtotal, VAT, and total amounts. The calculation formula was incorrect.

**Solution Implemented:**

#### A. Database Schema Enhancement
- Created new migration `006_add_discount_fields.js`
- Added two new columns to `quotations` table:
  - `discountPercentage` (decimal 5,2) - stores the discount percentage
  - `discountAmount` (decimal 12,2) - stores the calculated discount amount

#### B. Backend Updates
1. **SQL Service** (`backend/services/sqlService.js`)
   - Updated `createQuotation()` to save discount fields (lines 237-238)
   - Updated `updateQuotation()` to save discount fields (lines 456-457)

2. **Quotation Service** (`backend/services/quotationService.js`)
   - Updated `dbQuotationData` object to include discount fields (lines 322-323)

#### C. Frontend Updates
1. **Discount Calculation Fix** (`frontend/quotation-frontend/src/app/components/quotation-form/quotation-form.ts`)
   - Updated `calculateDiscountPercentageFromQuotation()` method (lines 1270-1307)
   - **New logic:**
     - If `discountPercentage` exists in database, use it directly
     - Otherwise, reverse-engineer using correct formula:
       ```
       subtotalAfterDiscount = totalAmount / (1 + vatRate/100)
       discountAmount = subtotal - subtotalAfterDiscount
       discountPercentage = (discountAmount / subtotal) * 100
       ```

## Testing Checklist

### For New Quotations:
- [ ] PQ number field is empty by default (no auto-generation)
- [ ] User can manually enter PQ number in format PQYYMMNNNN
- [ ] System validates the format (must match pattern `^PQ\d{8}$`)
- [ ] Discount percentage is saved correctly
- [ ] Discount is populated correctly when viewing/exporting

### For Quotation Editing:
- [ ] Opening an existing quotation shows next revision number (e.g., PQ25121234-REV1)
- [ ] Discount percentage field is populated from database
- [ ] Saving creates a new revision with incremented number
- [ ] Original quotation status is updated to "Revised"

## Database Migration

The migration has been successfully run:
```
Batch 4 run: 1 migrations
```

This added the `discountPercentage` and `discountAmount` columns to the `quotations` table.

## Backward Compatibility

The system maintains backward compatibility:
- Old quotations without discount fields will have discount calculated from totals
- New quotations will store discount fields explicitly
- Both methods work seamlessly

## Files Changed

### Created:
1. `/backend/migrations/006_add_discount_fields.js` - Database migration

### Modified:
1. `/backend/services/sqlService.js` - Added discount field handling
2. `/backend/services/quotationService.js` - Added discount to database save
3. `/frontend/quotation-frontend/src/app/components/quotation-form/quotation-form.ts` - Fixed discount calculation and PQ number handling

## Notes

- **PQ Number Format:** `PQYYMMNNNN` where:
  - `PQ` = Prefix
  - `YY` = 2-digit year (e.g., 25 for 2025)
  - `MM` = 2-digit month (e.g., 12 for December)
  - `NNNN` = 4-digit sequence (e.g., 1234)

- **Revision Format:** `PQYYMMNNNN-REVn` where n is the revision number (1, 2, 3, etc.)

- **Discount Storage:** Now properly stored in database for accurate retrieval and reporting
