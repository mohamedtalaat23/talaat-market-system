import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { PurchaseOrder } from '../hooks/usePurchaseQueries';
import { useReceivePurchaseOrder } from '../hooks/usePurchaseQueries';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import toast from 'react-hot-toast';

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrder: PurchaseOrder;
}

interface ReceiptItem {
  po_item_id: number;
  product_id: number;
  name: string;
  barcode: string | null;
  unit: string;
  ordered_quantity: number;
  received_quantity: number;
  shortage_quantity: number;
  remaining_quantity: number;
  quantity_to_receive: number;
  new_shortage_quantity: number;
  shortage_reason: string;
}

export function GoodsReceiptModal({ isOpen, onClose, purchaseOrder }: GoodsReceiptModalProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const { t } = useTranslation();
  const submission = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => {
    if (isOpen) submission.current = null;
  }, [isOpen]);
  const receivePO = useReceivePurchaseOrder();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (purchaseOrder?.items) {
      setItems(
        purchaseOrder.items
          .filter((item) => {
            const resolved = (item.received_quantity || 0) + (item.shortage_quantity || 0);
            return resolved < item.ordered_quantity;
          })
          .map((item) => {
            const resolved = (item.received_quantity || 0) + (item.shortage_quantity || 0);
            const remaining = Math.max(0, item.ordered_quantity - resolved);
            return {
              po_item_id: item.id!,
              product_id: item.product_id,
              name: item.product_name,
              barcode: item.barcode,
              unit: item.unit,
              ordered_quantity: item.ordered_quantity,
              received_quantity: item.received_quantity || 0,
              shortage_quantity: item.shortage_quantity || 0,
              remaining_quantity: remaining,
              quantity_to_receive: remaining,
              new_shortage_quantity: 0,
              shortage_reason: '',
            };
          }),
      );
    }
  }, [purchaseOrder]);

  const handleQtyChange = (productId: number, val: number) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.product_id === productId ? { ...item, quantity_to_receive: Math.max(0, val) } : item,
      ),
    );
  };

  const handleShortageChange = (productId: number, val: number) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.product_id === productId ? { ...item, new_shortage_quantity: Math.max(0, val) } : item,
      ),
    );
  };

  const handleReasonChange = (productId: number, val: string) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.product_id === productId ? { ...item, shortage_reason: val } : item,
      ),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (receivePO.isPending) return;

    if (items.length === 0) {
      toast.error(t('purchases.toasts.specifyQtyOrShortage'));
      return;
    }

    // Validate quantities
    for (const item of items) {
      if (item.quantity_to_receive < 0) {
        toast.error(t('purchases.qtyNegativeError').replace('{name}', item.name));
        return;
      }
      if (item.new_shortage_quantity < 0) {
        toast.error(t('purchases.toasts.shortageCannotBeNegative').replace('{name}', item.name));
        return;
      }
      if (item.quantity_to_receive + item.new_shortage_quantity > item.remaining_quantity) {
        toast.error(
          t('purchases.toasts.resolutionExceedsRemaining')
            .replace('{name}', item.name)
            .replace('{remaining}', String(item.remaining_quantity)),
        );
        return;
      }
    }

    const payload: {
      items: any[];
      notes?: string;
      idempotency_key?: string;
    } = {
      items: items
        .map((item) => ({
          po_item_id: item.po_item_id,
          product_id: item.product_id,
          quantity_to_receive: item.quantity_to_receive,
          shortage_quantity: item.new_shortage_quantity,
          shortage_reason: item.shortage_reason || null,
        }))
        .filter((i) => i.quantity_to_receive > 0 || i.shortage_quantity > 0),
    };

    if (notes) {
      payload.notes = notes;
    }

    if (payload.items.length === 0) {
      toast.error(t('purchases.toasts.specifyQtyOrShortage'));
      return;
    }

    const signature = JSON.stringify([purchaseOrder.id, payload]);
    if (submission.current?.signature !== signature)
      submission.current = { signature, key: crypto.randomUUID() };
    payload.idempotency_key = submission.current.key;
    receivePO.mutate(
      { id: purchaseOrder.id, payload },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('purchases.verifyGoodsReceipt')}
        className="flex flex-col w-full max-w-3xl max-h-[90vh] bg-input-bg border border-input-border rounded-xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-input-border bg-white">
          <div>
            <h2 className="text-lg font-bold text-input-text flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span>{t('purchases.verifyGoodsReceipt')}</span>
            </h2>
            <p className="text-xs text-secondary mt-0.5 font-mono">
              {t('purchases.poLabel').replace('{po}', purchaseOrder.po_number)}
            </p>
          </div>
          <button
            onClick={() => {
              if (!receivePO.isPending) onClose();
            }}
            className="text-secondary hover:text-input-text"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Warning Alert Banner */}
          <div className="p-4 rounded-lg bg-warning/15 border border-warning/30 text-warning text-xs leading-relaxed flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">{t('purchases.criticalWorkflow')}</span>
              <p>{t('purchases.criticalWorkflowDesc')}</p>
            </div>
          </div>

          {/* Supplier Info */}
          <div className="p-3.5 rounded-lg border border-input-border bg-white flex flex-col sm:flex-row justify-between text-xs gap-3">
            <div>
              <span className="text-secondary block mb-0.5 uppercase tracking-wider font-semibold">
                {t('purchases.supplierName')}
              </span>
              <span className="text-input-text font-bold">{purchaseOrder.supplier_name}</span>
            </div>
            <div className="sm:text-right">
              <span className="text-secondary block mb-0.5 uppercase tracking-wider font-semibold">
                {t('purchases.supplierCode')}
              </span>
              <span className="text-input-text font-mono">{purchaseOrder.supplier_code}</span>
            </div>
          </div>

          {/* Items Listing */}
          <div className="rounded-xl border border-input-border bg-white overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-input-border bg-white text-secondary font-semibold">
                  <th className="py-2.5 px-3">{t('purchases.product')}</th>
                  <th className="py-2.5 px-3 text-center">{t('purchases.remainingHeader')}</th>
                  <th className="py-2.5 px-3 text-center w-28">
                    {t('purchases.receiveQtyHeader')}
                  </th>
                  <th className="py-2.5 px-3 text-center w-28">
                    {t('purchases.shortageQtyHeader')}
                  </th>
                  <th className="py-2.5 px-3 w-36">{t('purchases.reasonHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-secondary italic">
                      {t('purchases.allResolved')}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.product_id} className="hover:bg-white text-neutral-300">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-input-text">{item.name}</div>
                        <div className="text-xs text-secondary font-mono">
                          {item.barcode || t('common.na')} - {item.unit}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold text-secondary">
                        {item.remaining_quantity}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Input
                          type="number"
                          min="0"
                          max={item.remaining_quantity}
                          step="any"
                          value={item.quantity_to_receive}
                          onChange={(e) => handleQtyChange(item.product_id, Number(e.target.value))}
                          className="bg-input-bg border-input-border text-center py-1 h-8 text-xs font-mono font-bold text-success w-full focus:border-success"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Input
                          type="number"
                          min="0"
                          max={item.remaining_quantity}
                          step="any"
                          value={item.new_shortage_quantity}
                          onChange={(e) =>
                            handleShortageChange(item.product_id, Number(e.target.value))
                          }
                          className="bg-input-bg border-input-border text-center py-1 h-8 text-xs font-mono font-bold text-warning w-full focus:border-warning"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          className="bg-input-bg border border-input-border text-input-text text-xs rounded p-1 w-full h-8 placeholder:text-input-placeholder"
                          value={item.shortage_reason}
                          onChange={(e) => handleReasonChange(item.product_id, e.target.value)}
                          disabled={item.new_shortage_quantity <= 0}
                        >
                          <option value="">{t('purchases.selectReason')}</option>
                          <option value="backordered">{t('purchases.reasons.backordered')}</option>
                          <option value="supplier_cancelled">
                            {t('purchases.reasons.supplier_cancelled')}
                          </option>
                          <option value="damaged_in_transit">
                            {t('purchases.reasons.damaged_in_transit')}
                          </option>
                          <option value="substituted">{t('purchases.reasons.substituted')}</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Notes Area */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-secondary">
              {t('purchases.receiptVerificationNotes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('purchases.receiptNotesPlaceholder')}
              rows={2}
              className="w-full bg-input-bg text-input-text border border-input-border rounded-lg py-2 px-3 focus:outline-none focus:border-input-focus text-sm"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-input-border bg-white space-x-3">
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              if (!receivePO.isPending) onClose();
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={receivePO.isPending}
            className="bg-success hover:bg-success/90 text-white font-bold flex items-center space-x-1.5"
          >
            <span>{t('purchases.confirmInflux')}</span>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
