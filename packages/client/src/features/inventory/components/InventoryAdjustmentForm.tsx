import React, { useState, useEffect } from 'react';
import { calculateExpectedStock, type AdjustmentType } from '../utils/calculations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import type { InventoryItem } from '../hooks/useInventoryQueries';

interface InventoryAdjustmentFormProps {
  item: InventoryItem;
  onSubmit: (data: { adjustment_type: AdjustmentType; quantity_change: number; notes: string }) => void;
  isLoading: boolean;
  onCancel: () => void;
}

export function InventoryAdjustmentForm({
  item,
  onSubmit,
  isLoading,
  onCancel,
}: InventoryAdjustmentFormProps) {
  const [type, setType] = useState<AdjustmentType>('stock_addition');
  const [changeValue, setChangeValue] = useState('');
  const [notes, setNotes] = useState('');

  const [expectedStock, setExpectedStock] = useState(item.quantity);
  const [isFormValid, setIsFormValid] = useState(true);
  const [warningMessage, setWarningMessage] = useState('');

  // Dynamically calculate expected stock on any input changes using centralized utility logic
  useEffect(() => {
    const val = parseFloat(changeValue);
    const { newQuantity, isValid, notes: calculationNote } = calculateExpectedStock(
      item.quantity,
      type,
      val
    );

    setExpectedStock(newQuantity);
    setIsFormValid(isValid);
    setWarningMessage(calculationNote);
  }, [changeValue, type, item.quantity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isLoading) return;

    const val = parseFloat(changeValue);
    if (isNaN(val) || val <= 0) {
      setWarningMessage('Please enter a valid positive change quantity');
      return;
    }

    // Determine the actual quantity change signed value for relative adjustments
    let finalChange = val;
    if (type === 'stock_removal' || type === 'damaged' || type === 'expired') {
      finalChange = -val;
    } else if (type === 'manual_correction') {
      // For manual correction, the input represents the target count, but the POST relative adjust expects a delta
      finalChange = val - item.quantity;
    }

    onSubmit({
      adjustment_type: type,
      quantity_change: finalChange,
      notes: notes.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 select-text">
      {/* Product Card Header */}
      <div className="rounded-lg bg-neutral-900 border border-border p-4 space-y-1">
        <div className="text-xs text-secondary font-semibold uppercase tracking-wider">Item Details</div>
        <div className="font-bold text-foreground text-sm">{item.product_name}</div>
        <div className="flex justify-between text-xs text-secondary pt-2 border-t border-border/60 mt-2 font-mono">
          <span>Barcode: {item.product_barcode || 'Loose Produce'}</span>
          <span>Current Level: <strong className="text-foreground">{item.quantity} {item.product_unit}</strong></span>
        </div>
      </div>

      {warningMessage && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          {warningMessage}
        </div>
      )}

      {/* Input Adjustments Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="adjustType" className="text-xs font-semibold text-neutral-300">
            Adjustment Type
          </label>
          <select
            id="adjustType"
            value={type}
            onChange={(e) => {
              setType(e.target.value as AdjustmentType);
              setChangeValue(''); // Reset inputs
            }}
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-border bg-neutral-900/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          >
            <option value="stock_addition">Stock Addition (+)</option>
            <option value="stock_removal">Stock Removal (-)</option>
            <option value="damaged">Damaged Stock (-)</option>
            <option value="expired">Expired Stock (-)</option>
            <option value="manual_correction">Manual Stocktake Count (Override)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="changeValue" className="text-xs font-semibold text-neutral-300">
            {type === 'manual_correction' ? 'Target Stock Count' : 'Change Quantity'} *
          </label>
          <Input
            id="changeValue"
            type="number"
            step="0.001"
            min="0"
            placeholder={type === 'manual_correction' ? 'e.g. 50' : 'e.g. 10'}
            value={changeValue}
            onChange={(e) => setChangeValue(e.target.value)}
            disabled={isLoading}
            error={!isFormValid}
            required
          />
        </div>
      </div>

      {/* Preview Calculations */}
      <div className="grid grid-cols-3 gap-2 bg-neutral-900/40 rounded-lg p-3 border border-border text-center select-none font-mono">
        <div>
          <div className="text-[10px] text-neutral-500 uppercase font-semibold">Current</div>
          <div className="text-sm font-bold text-neutral-300">{item.quantity}</div>
        </div>
        <div className="flex items-center justify-center text-neutral-500 text-sm">➔</div>
        <div>
          <div className="text-[10px] text-neutral-500 uppercase font-semibold">Expected New</div>
          <div className={`text-sm font-bold ${isFormValid ? 'text-primary' : 'text-destructive'}`}>
            {expectedStock}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="notes" className="text-xs font-semibold text-neutral-300">
          Reason / Audit Notes *
        </label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Include specific shift explanations (e.g. Broken packaging, expired expiration date, stocktake verification)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isLoading}
          required
          className="flex w-full rounded-md border border-border bg-neutral-900/50 px-3 py-2 text-sm text-foreground placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
      </div>

      <div className="flex justify-end space-x-2 border-t border-border pt-4 mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="font-medium min-w-[100px]"
          disabled={isLoading || !isFormValid || !changeValue}
        >
          {isLoading ? (
            <div className="flex items-center space-x-1.5">
              <Spinner size="sm" />
              <span>Applying...</span>
            </div>
          ) : (
            <span>Apply Adjustment</span>
          )}
        </Button>
      </div>
    </form>
  );
}
export default InventoryAdjustmentForm;
