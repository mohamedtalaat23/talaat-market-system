import React, { useState, useEffect } from 'react';
import { calculateExpectedStock, type AdjustmentType } from '../utils/calculations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useTranslation } from '@/hooks/useTranslation';
import type { InventoryItem } from '../hooks/useInventoryQueries';

interface InventoryAdjustmentFormProps {
  item: InventoryItem;
  onSubmit: (data: {
    adjustment_type: AdjustmentType;
    quantity_change: number;
    notes: string;
  }) => void;
  isLoading: boolean;
  onCancel: () => void;
}

export function InventoryAdjustmentForm({
  item,
  onSubmit,
  isLoading,
  onCancel,
}: InventoryAdjustmentFormProps) {
  const { t, language } = useTranslation();
  const [type, setType] = useState<AdjustmentType>('stock_addition');
  const [changeValue, setChangeValue] = useState('');
  const [notes, setNotes] = useState('');

  const [expectedStock, setExpectedStock] = useState(item.quantity);
  const [isFormValid, setIsFormValid] = useState(true);
  const [warningMessage, setWarningMessage] = useState('');

  // Dynamically calculate expected stock on any input changes using centralized utility logic
  useEffect(() => {
    const val = parseFloat(changeValue);
    const {
      newQuantity,
      isValid,
      notes: calculationNote,
    } = calculateExpectedStock(item.quantity, type, val);

    setExpectedStock(newQuantity);
    setIsFormValid(isValid);
    setWarningMessage(calculationNote);
  }, [changeValue, type, item.quantity]);

  const getWarningTranslation = (msg: string) => {
    if (!msg) return '';
    if (language !== 'ar') return msg;
    if (msg.startsWith('Addition quantity')) return 'يجب أن تكون كمية الإضافة غير سالبة';
    if (msg.startsWith('Change quantity')) return 'يجب أن تكون كمية التغيير غير سالبة';
    if (msg.startsWith('Cannot adjust past zero'))
      return `لا يمكن تعديل المخزون لأقل من الصفر. أقصى كمية صرف مسموح بها هي ${item.quantity}`;
    if (msg.startsWith('Inventory count cannot be negative'))
      return 'لا يمكن أن تكون كمية المخزون سالبة';
    if (msg.startsWith('Please enter a valid positive'))
      return 'يرجى إدخال كمية تغيير إيجابية صالحة';
    return msg;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isLoading) return;

    const val = parseFloat(changeValue);
    if (isNaN(val) || val <= 0) {
      setWarningMessage(
        language === 'ar'
          ? 'يرجى إدخال كمية تغيير إيجابية صالحة'
          : 'Please enter a valid positive change quantity',
      );
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
      <div className="rounded-lg bg-card border border-input-border p-4 flex flex-col gap-1">
        <div className="text-xs text-secondary font-semibold uppercase tracking-wider">
          {t('inventory.itemDetails')}
        </div>
        <div className="font-bold text-input-text text-sm">{item.product_name}</div>
        <div className="flex justify-between text-xs text-secondary pt-2 border-t border-input-border/60 mt-2 font-mono">
          <span>
            {t('inventory.barcode')}: {item.product_barcode || t('products.looseProduce')}
          </span>
          <span>
            {t('inventory.currentLevel')}:{' '}
            <strong className="text-input-text">
              {item.quantity} {item.product_unit}
            </strong>
          </span>
        </div>
      </div>

      {warningMessage && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          {getWarningTranslation(warningMessage)}
        </div>
      )}

      {/* Input Adjustments Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="adjustType" className="text-xs font-semibold text-secondary">
            {t('inventory.adjustmentType')}
          </label>
          <select
            id="adjustType"
            value={type}
            onChange={(e) => {
              setType(e.target.value as AdjustmentType);
              setChangeValue(''); // Reset inputs
            }}
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-input-border bg-input-bg px-3 py-2 text-sm text-input-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
          >
            <option value="stock_addition">{t('inventory.stockAddition')}</option>
            <option value="stock_removal">{t('inventory.stockRemoval')}</option>
            <option value="damaged">{t('inventory.damagedStock')}</option>
            <option value="expired">{t('inventory.expiredStock')}</option>
            <option value="manual_correction">{t('inventory.manualCorrection')}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="changeValue" className="text-xs font-semibold text-secondary">
            {type === 'manual_correction'
              ? t('inventory.targetStockCount')
              : t('inventory.changeQty')}{' '}
            *
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
      <div className="grid grid-cols-3 gap-2 bg-card-hover/40 rounded-lg p-3 border border-input-border text-center select-none font-mono">
        <div>
          <div className="text-xs text-secondary uppercase font-semibold">
            {t('inventory.current')}
          </div>
          <div className="text-sm font-bold text-input-text">{item.quantity}</div>
        </div>
        <div className="flex items-center justify-center text-neutral-500 text-sm">➔</div>
        <div>
          <div className="text-xs text-secondary uppercase font-semibold">
            {t('inventory.expectedNew')}
          </div>
          <div className={`text-sm font-bold ${isFormValid ? 'text-primary' : 'text-destructive'}`}>
            {expectedStock}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="notes" className="text-xs font-semibold text-secondary">
          {t('inventory.reasonNotes')}
        </label>
        <textarea
          id="notes"
          rows={3}
          placeholder={t('inventory.placeholderNotes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isLoading}
          required
          className="flex w-full rounded-md border border-input-border bg-input-bg px-3 py-2 text-sm text-input-text placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-input-border pt-4 mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          className="font-medium min-w-[100px]"
          disabled={isLoading || !isFormValid || !changeValue}
        >
          {isLoading ? (
            <div className="flex items-center gap-1.5">
              <Spinner size="sm" />
              <span>{t('inventory.applying')}</span>
            </div>
          ) : (
            <span>{t('inventory.applyAdjustment')}</span>
          )}
        </Button>
      </div>
    </form>
  );
}
export default InventoryAdjustmentForm;
