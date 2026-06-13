import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalStore } from '@/stores/modalStore';
import { X, AlertTriangle, RefreshCcw,  } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { InlineManagerApproval } from './InlineManagerApproval';

export function RefundModal() {
  const { activeModals, closeModal, modalPayloads, openModal } = useModalStore();
  const isOpen = activeModals.pos_refund;
  const sale = modalPayloads.pos_refund?.sale;

  const [quantitiesToRefund, setQuantitiesToRefund] = useState<Record<number, number>>({});
  const [restockToggles, setRestockToggles] = useState<Record<number, boolean>>({});
  const [reason, setReason] = useState('');
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);

  const [managerId, setManagerId] = useState<number | ''>('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const isEligibleForVoid = sale?.status === 'completed';

  const items = sale?.items || [];
  
  const refundTotal = useMemo(() => {
    return items.reduce((total: number, item: any) => {
      const qty = quantitiesToRefund[item.id] || 0;
      const unitPrice = Number(item.unit_price) - Number(item.discount || 0);
      return total + (qty * unitPrice);
    }, 0);
  }, [items, quantitiesToRefund]);

  const handleQtyChange = (itemId: number, maxQty: number, val: string) => {
    let num = Number(val);
    if (isNaN(num) || num < 0) num = 0;
    if (num > maxQty) num = maxQty;
    
    setQuantitiesToRefund(prev => ({ ...prev, [itemId]: num }));
  };

  const handleRestockToggle = (itemId: number) => {
    setRestockToggles(prev => ({
      ...prev,
      [itemId]: prev[itemId] === undefined ? false : !prev[itemId]
    }));
  };

  const itemsToRefund = items
    .filter((item: any) => (quantitiesToRefund[item.id] || 0) > 0)
    .map((item: any) => ({
      sale_item_id: item.id,
      quantity: quantitiesToRefund[item.id] || 0,
      restock_inventory: restockToggles[item.id] ?? true
    }));

  const handleProcessRefund = async () => {
    if (itemsToRefund.length === 0 || !sale) return;
    if (!pin || managerId === '') {
      import('react-hot-toast').then(({ default: toast }) => toast.error('Manager PIN required'));
      return;
    }

    setIsSubmitting(true);
    try {
      const { apiClient } = await import('@/services/api-client');
      const toast = (await import('react-hot-toast')).default;
      
      const verifyRes = await apiClient.post('/employees/verify-pin', { manager_id: managerId, pin });
      if (!verifyRes.data?.success) {
        toast.error('Invalid Manager PIN');
        setIsSubmitting(false);
        setPin('');
        return;
      }
      
      const payload = {
        manager_id: managerId,
        reason: reason || 'Customer Return',
        refund_type: 'partial',
        items: itemsToRefund
      };
      
      const response = await apiClient.post(`/pos/sales/${sale.id}/refund`, payload);
      if (response.data?.success) {
        toast.success('Refund processed successfully');
        closeModal('pos_refund');
        
        const resultData = response.data.data;
        if (resultData?.refund_receipt_number) {
          const refundSale = {
            receipt_number: resultData.refund_receipt_number,
            created_at: new Date().toISOString(),
            cashier_id: sale.cashier_id,
            total: -resultData.total_refunded,
            subtotal: -resultData.total_refunded,
            payment_method: 'refund',
            items: itemsToRefund.map((reqItem: any) => {
               const origItem = items.find((i: any) => i.id === reqItem.sale_item_id);
               return {
                 product_name: origItem ? origItem.product_name : 'Refunded Item',
                 quantity: reqItem.quantity,
                 unit_price: origItem ? origItem.unit_price : 0,
                 line_total: origItem ? (reqItem.quantity * origItem.unit_price) : 0,
                 discount: 0
               };
            })
          };
          openModal('pos_receipt_preview', { sale: refundSale });
        }
      }
    } catch (error: any) {
      const toast = (await import('react-hot-toast')).default;
      toast.error(error.response?.data?.message || 'Failed to process refund');
    } finally {
      setIsSubmitting(false);
      setPin('');
    }
  };

  const handleVoidSale = async () => {
    if (!sale) return;
    if (!pin || managerId === '') {
      import('react-hot-toast').then(({ default: toast }) => toast.error('Manager PIN required'));
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { apiClient } = await import('@/services/api-client');
      const toast = (await import('react-hot-toast')).default;
      
      const verifyRes = await apiClient.post('/employees/verify-pin', { manager_id: managerId, pin });
      if (!verifyRes.data?.success) {
        toast.error('Invalid Manager PIN');
        setIsSubmitting(false);
        setPin('');
        return;
      }
      
      const response = await apiClient.post(`/pos/sales/${sale.id}/void`, {
        manager_id: managerId,
        reason: reason || 'Void Transaction'
      });
      
      if (response.data?.success) {
        toast.success('Sale voided successfully');
        closeModal('pos_refund');
        
        const resultData = response.data.data;
        if (resultData?.refund_receipt_number) {
          const voidSale = {
            receipt_number: resultData.refund_receipt_number,
            created_at: new Date().toISOString(),
            cashier_id: sale.cashier_id,
            total: -resultData.total_refunded,
            subtotal: -resultData.total_refunded,
            payment_method: 'void',
            items: items.map((origItem: any) => ({
                 product_name: origItem.product_name,
                 quantity: origItem.quantity - (origItem.refunded_quantity || 0),
                 unit_price: origItem.unit_price,
                 line_total: (origItem.quantity - (origItem.refunded_quantity || 0)) * origItem.unit_price,
                 discount: 0
            })).filter((i: any) => i.quantity > 0)
          };
          openModal('pos_receipt_preview', { sale: voidSale });
        }
      }
    } catch (error: any) {
      const toast = (await import('react-hot-toast')).default;
      toast.error(error.response?.data?.message || 'Failed to void sale');
    } finally {
      setIsSubmitting(false);
      setPin('');
    }
  };

  useEffect(() => {
    if (!isOpen || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept if typing in the reason field, except Enter to submit or Esc to close
      if (e.target instanceof HTMLInputElement && e.target.type === 'text') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleProcessRefund();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedRowIndex(prev => Math.min(items.length - 1, prev + 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedRowIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
        case 'ArrowLeft': {
          e.preventDefault();
          const item = items[focusedRowIndex];
          if (!item) break;
          const refundable = Number(item.quantity) - Number(item.refunded_quantity || 0);
          if (refundable <= 0) break;

          const currentQty = quantitiesToRefund[item.id] || 0;
          let newQty = currentQty;
          if (e.key === 'ArrowRight') newQty = Math.min(refundable, currentQty + 1);
          if (e.key === 'ArrowLeft') newQty = Math.max(0, currentQty - 1);

          handleQtyChange(item.id, refundable, String(newQty));
          break;
        }
        case ' ':
        case 'Spacebar': {
          e.preventDefault();
          const item = items[focusedRowIndex];
          if (item) {
            const refundable = Number(item.quantity) - Number(item.refunded_quantity || 0);
            if (refundable > 0) {
              handleRestockToggle(item.id);
            }
          }
          break;
        }
        case 'r':
        case 'R':
        case 'w':
        case 'W': {
          e.preventDefault();
          const item = items[focusedRowIndex];
          if (item) {
            const refundable = Number(item.quantity) - Number(item.refunded_quantity || 0);
            if (refundable > 0) {
              const isRestock = e.key.toLowerCase() === 'r';
              setRestockToggles(prev => ({ ...prev, [item.id]: isRestock }));
            }
          }
          break;
        }
        case 'Enter':
          e.preventDefault();
          handleProcessRefund();
          break;
        case 'Escape':
          e.preventDefault();
          closeModal('pos_refund');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, focusedRowIndex, quantitiesToRefund, reason]);

  if (!isOpen || !sale) return null;

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 text-input-text">
      <div className="absolute inset-0" onClick={() => closeModal('pos_refund')} />
      <div ref={focusTrapRef} className="w-full max-w-4xl bg-card border border-input-border rounded-xl shadow-2xl relative z-10 animate-fade-in flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-input-border bg-card-hover/50">
          <div className="flex items-center space-x-3">
            <RefreshCcw className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold">Refund / Void Sale {sale.receipt_number}</h2>
          </div>
          <button onClick={() => closeModal('pos_refund')} className="text-secondary hover:text-white p-1 rounded-md hover:bg-card-hover transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          
          <div className="flex justify-between items-center bg-card-hover/30 p-3 rounded-lg border border-input-border/50">
            <div>
              <p className="text-sm text-secondary">Sale Total</p>
              <p className="text-lg font-bold">EGP {Number(sale.total).toFixed(2)}</p>
            </div>
            {isEligibleForVoid && (
              <button 
                onClick={handleVoidSale}
                className="px-4 py-2 bg-danger hover:bg-danger/90 text-white rounded font-medium flex items-center space-x-2 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Void Entire Sale</span>
              </button>
            )}
          </div>

          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-input-border text-secondary">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 font-medium text-center">Unit Price</th>
                <th className="pb-2 font-medium text-center">Sold</th>
                <th className="pb-2 font-medium text-center">Returned</th>
                <th className="pb-2 font-medium text-center">Return Qty</th>
                <th className="pb-2 font-medium text-center">Restock?</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, index: number) => {
                const refundable = Number(item.quantity) - Number(item.refunded_quantity || 0);
                const isRestock = restockToggles[item.id] ?? true;
                const isFocused = index === focusedRowIndex;

                return (
                  <tr key={item.id} className={`border-b border-input-border/50 transition-colors ${isFocused ? 'bg-primary/20 ring-1 ring-inset ring-primary' : ''}`}>
                    <td className="py-3">
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-xs text-secondary">{item.barcode}</div>
                    </td>
                    <td className="py-3 text-center">EGP {(Number(item.unit_price) - Number(item.discount || 0)).toFixed(2)}</td>
                    <td className="py-3 text-center">{item.quantity}</td>
                    <td className="py-3 text-center text-warning">{item.refunded_quantity || 0}</td>
                    <td className="py-3">
                      <div className="flex justify-center">
                        <input 
                          type="number"
                          min="0"
                          max={refundable}
                          step="0.01"
                          disabled={refundable <= 0}
                          value={quantitiesToRefund[item.id] || ''}
                          onChange={(e) => handleQtyChange(item.id, refundable, e.target.value)}
                          className="w-20 bg-input-bg border border-input-border rounded text-center py-1 focus:outline-none focus:border-input-focus disabled:opacity-50"
                          placeholder="0"
                        />
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-center">
                        <button
                          disabled={refundable <= 0}
                          onClick={() => handleRestockToggle(item.id)}
                          className={`px-3 py-1 rounded text-xs font-medium border transition-colors disabled:opacity-50 ${isRestock ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30'}`}
                        >
                          {isRestock ? 'Restock' : 'Write-Off'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div>
            <label className="block text-sm text-secondary mb-1">Reason for Reversal</label>
            <input 
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer Return, Damaged..."
              className="w-full bg-input-bg border border-input-border rounded py-2 px-3 text-input-text focus:outline-none focus:border-input-focus"
            />
          </div>

        </div>

        <div className="p-4 border-t border-input-border bg-card-hover/30">
          <InlineManagerApproval
            managerId={managerId}
            setManagerId={setManagerId}
            pin={pin}
            setPin={setPin}
            isSubmitting={isSubmitting}
            contextMetadata={
              <>
                <div>{itemsToRefund.length > 0 ? `REFUND: EGP ${refundTotal.toFixed(2)}` : 'Please select items to refund'}</div>
                {itemsToRefund.length > 0 && (
                  <div className={itemsToRefund.some((i: any) => !i.restock_inventory) ? 'text-danger mt-0.5' : 'text-success mt-0.5'}>
                    {itemsToRefund.some((i: any) => !i.restock_inventory) ? 'WRITE-OFF (Contains Damage)' : 'RESTOCK'}
                  </div>
                )}
              </>
            }
          />
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-secondary flex space-x-3 items-center">
              <span><kbd className="px-1.5 py-0.5 bg-input-bg rounded border border-input-border">↑/↓</kbd> Navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-input-bg rounded border border-input-border">←/→</kbd> Qty</span>
              <span><kbd className="px-1.5 py-0.5 bg-input-bg rounded border border-input-border">Space</kbd> or <kbd className="px-1.5 py-0.5 bg-input-bg rounded border border-input-border">R/W</kbd> Toggle</span>
              <span><kbd className="px-1.5 py-0.5 bg-input-bg rounded border border-input-border">Enter</kbd> Submit</span>
              <span><kbd className="px-1.5 py-0.5 bg-input-bg rounded border border-input-border">Esc</kbd> Cancel</span>
            </div>
            <button 
              onClick={handleProcessRefund}
              disabled={refundTotal <= 0 || isSubmitting}
              className="px-6 py-3 bg-warning hover:bg-warning/90 text-warning-foreground font-bold rounded shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? 'Processing...' : 'Process Refund'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default RefundModal;
