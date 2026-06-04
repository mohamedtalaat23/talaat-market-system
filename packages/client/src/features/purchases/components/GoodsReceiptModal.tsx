import { useState, useEffect } from 'react';
import { useReceivePurchaseOrder, PurchaseOrder } from '../hooks/usePurchaseQueries';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrder: PurchaseOrder;
}

interface ReceiptItem {
  product_id: number;
  name: string;
  barcode: string | null;
  unit: string;
  ordered_quantity: number;
  received_quantity: number;
}

export function GoodsReceiptModal({ isOpen, onClose, purchaseOrder }: GoodsReceiptModalProps) {
  const receivePO = useReceivePurchaseOrder();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (purchaseOrder?.items) {
      setItems(
        purchaseOrder.items.map((item) => ({
          product_id: item.product_id,
          name: item.product_name,
          barcode: item.barcode,
          unit: item.unit,
          ordered_quantity: item.ordered_quantity,
          received_quantity: item.ordered_quantity, // Pre-fill with ordered quantity
        })),
      );
    }
  }, [purchaseOrder]);

  const handleQtyChange = (productId: number, val: number) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.product_id === productId ? { ...item, received_quantity: Math.max(0, val) } : item,
      ),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error('No items to receive');
      return;
    }

    // Validate quantities
    for (const item of items) {
      if (item.received_quantity < 0) {
        toast.error(`Received quantity for "${item.name}" cannot be negative`);
        return;
      }
    }

    const payload = {
      items: items.map((item) => ({
        product_id: item.product_id,
        received_quantity: item.received_quantity,
      })),
    };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col w-full max-w-3xl max-h-[85vh] bg-input border border-border rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-neutral-900/40">
          <div>
            <h2 className="text-lg font-bold text-neutral-100 flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span>Verify Goods Receipt</span>
            </h2>
            <p className="text-xs text-secondary mt-0.5 font-mono">
              Purchase Order: {purchaseOrder.po_number}
            </p>
          </div>
          <button onClick={onClose} className="text-secondary hover:text-neutral-200">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Warning Alert Banner */}
          <div className="p-4 rounded-lg bg-warning/15 border border-warning/30 text-warning text-xs leading-relaxed flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">CRITICAL TRANSACTION WORKFLOW</span>
              <p>
                Confirming this action will finalize the Purchase Order. This process executes
                atomic database increments of catalog inventory levels, registers irreversible audit
                adjustments, and dynamically recalculates catalog item unit costs using Weighted
                Average Costing (AVCO). This process is permanent and cannot be undone.
              </p>
            </div>
          </div>

          {/* Supplier Info */}
          <div className="p-3.5 rounded-lg border border-border bg-neutral-900/20 flex flex-col sm:flex-row justify-between text-xs gap-3">
            <div>
              <span className="text-secondary block mb-0.5 uppercase tracking-wider font-semibold">
                Supplier Name
              </span>
              <span className="text-neutral-200 font-bold">{purchaseOrder.supplier_name}</span>
            </div>
            <div className="sm:text-right">
              <span className="text-secondary block mb-0.5 uppercase tracking-wider font-semibold">
                Supplier Code
              </span>
              <span className="text-neutral-200 font-mono">{purchaseOrder.supplier_code}</span>
            </div>
          </div>

          {/* Items Listing */}
          <div className="rounded-xl border border-border bg-neutral-900/10 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-neutral-900/40 text-secondary font-semibold">
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3 text-center">Barcode</th>
                  <th className="py-2.5 px-3 text-center">Ordered Qty</th>
                  <th className="py-2.5 px-3 text-center w-36">Received Qty *</th>
                  <th className="py-2.5 px-3 text-center">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {items.map((item) => (
                  <tr key={item.product_id} className="hover:bg-neutral-900/10 text-neutral-300">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-neutral-200">{item.name}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-neutral-500">
                      {item.barcode || 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-secondary">
                      {item.ordered_quantity}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={item.received_quantity}
                          onChange={(e) => handleQtyChange(item.product_id, Number(e.target.value))}
                          className="bg-input border-border text-center py-1 h-8 text-xs font-mono font-bold text-success w-24 focus:border-success"
                        />
                        {item.received_quantity !== item.ordered_quantity && (
                          <span className="text-[10px] font-bold text-warning font-mono uppercase bg-warning/15 px-1 border border-warning/30 rounded shrink-0">
                            Diff
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center text-neutral-500 font-mono uppercase">
                      {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes Area */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-secondary">
              Receipt Verification Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Shortages noted due to delivery damage, all other items accounted for..."
              rows={2}
              className="w-full bg-neutral-900 text-neutral-200 border border-border rounded-lg py-2 px-3 focus:outline-none focus:border-primary text-sm"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-border bg-neutral-900/40 space-x-3">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={receivePO.isPending}
            className="bg-success hover:bg-success/90 text-white font-bold flex items-center space-x-1.5"
          >
            <span>Confirm Influx</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
