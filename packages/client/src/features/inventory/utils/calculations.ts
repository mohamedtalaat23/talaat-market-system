/**
 * Types of inventory stock adjustments.
 */
export type AdjustmentType =
  | 'stock_addition'
  | 'stock_removal'
  | 'damaged'
  | 'expired'
  | 'manual_correction';

/**
 * Interface detailing the calculation output.
 */
export interface AdjustmentCalculationResult {
  newQuantity: number;
  isValid: boolean;
  notes: string;
}

/**
 * Centralized business logic calculations for stock adjustments.
 *
 * Enforces:
 * 1. Addition adds positive quantities directly.
 * 2. Removals, Damaged, and Expired subtract from the stock count.
 * 3. Manual Correction overrides the current stock to the entered value directly.
 * 4. Ensures new stock counts never drop below zero.
 */
export function calculateExpectedStock(
  currentQuantity: number,
  type: AdjustmentType,
  inputValue: number
): AdjustmentCalculationResult {
  // If the user hasn't entered anything, new quantity remains identical
  if (isNaN(inputValue)) {
    return {
      newQuantity: currentQuantity,
      isValid: true,
      notes: '',
    };
  }

  let newQuantity = currentQuantity;
  let isValid = true;
  let notes = '';

  switch (type) {
    case 'stock_addition':
      newQuantity = currentQuantity + inputValue;
      isValid = inputValue >= 0;
      if (!isValid) notes = 'Addition quantity must be non-negative';
      break;

    case 'stock_removal':
    case 'damaged':
    case 'expired':
      newQuantity = currentQuantity - inputValue;
      isValid = inputValue >= 0 && newQuantity >= 0;
      if (inputValue < 0) {
        notes = 'Change quantity must be non-negative';
      } else if (newQuantity < 0) {
        notes = `Cannot adjust past zero. Maximum removal allowed is ${currentQuantity}`;
      }
      break;

    case 'manual_correction':
      newQuantity = inputValue;
      isValid = inputValue >= 0;
      if (!isValid) notes = 'Inventory count cannot be negative';
      break;

    default:
      isValid = false;
      notes = 'Unknown adjustment type';
  }

  return {
    newQuantity,
    isValid,
    notes,
  };
}
