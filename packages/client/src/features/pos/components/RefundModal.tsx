import toast from 'react-hot-toast';
import { apiClient } from '@/services/api-client';
import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalStore } from '@/stores/modalStore';
import { X, AlertTriangle, RefreshCcw } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { InlineManagerApproval } from './InlineManagerApproval';
import { bankersRound } from '@/utils/currency';
import { useTranslation } from '@/hooks/useTranslation';

export function RefundModal() {
  const { t } = useTranslation();
  const { activeModals, closeModal, modalPayloads, openModal } = useModalStore();
  const isOpen = activeModals.pos_refund;
  const sale = modalPayloads.pos_refund?.sale;
  const refundKey = useRef('');
  useEffect(() => {
    if (isOpen) refundKey.current = crypto.randomUUID();
  }, [isOpen, sale?.id]);

  const [quantitiesToRefund, setQuantitiesToRefund] = useState<Record<number, number>>({});
  const [restockToggles, setRestockToggles] = useState<Record<number, boolean>>({});
  const [reason, setReason] = useState('');
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);

  const [managerId, setManagerId] = useState<number | ''>('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const isEligibleForVoid = sale?.status === 'completed';

  const items = useMemo(() => sale?.items || [], [sale]);

  const refundBreakdown = useMemo(() => {
    const ordered = [...items].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const grossCents = ordered.reduce(
      (sum, item) => sum + Math.round(Number(item.line_total) * 100),
      0,
    );
    const paidCents = Math.round(Number(sale?.total || 0) * 100);
    let cumulative = 0;
    let allocated = 0;
    let refundCents = 0;
    const lines: Record<string, number> = {};
    for (const item of ordered) {
      cumulative += Math.round(Number(item.line_total) * 100);
      const next = grossCents ? bankersRound((paidCents * cumulative) / grossCents, 0) : 0;
      const netLineCents = next - allocated;
      allocated = next;
      const previous = Number(item.refunded_quantity || 0);
      const quantity = quantitiesToRefund[item.id] || 0;
      const lineCents =
        bankersRound((netLineCents * (previous + quantity)) / Number(item.quantity), 0) -
        bankersRound((netLineCents * previous) / Number(item.quantity), 0);
      lines[item.id] = lineCents / 100;
      refundCents += lineCents;
    }
    return { total: refundCents / 100, lines };
  }, [items, quantitiesToRefund, sale?.total]);

  const refundTotal = refundBreakdown.total;

  const handleQtyChange = (itemId: number, maxQty: number, val: string) => {
    let num = Number(val);
    if (isNaN(num) || num < 0) num = 0;
    if (num > maxQty) num = maxQty;

    setQuantitiesToRefund((prev) => ({ ...prev, [itemId]: num }));
  };

  const handleRestockToggle = (itemId: number) => {
    setRestockToggles((prev) => ({
      ...prev,
      [itemId]: prev[itemId] === undefined ? false : !prev[itemId],
    }));
  };

  const itemsToRefund = useMemo(
    () =>
      items
        .filter((item: any) => (quantitiesToRefund[item.id] || 0) > 0)
        .map((item: any) => ({
          sale_item_id: item.id,
          quantity: quantitiesToRefund[item.id] || 0,
          restock_inventory: restockToggles[item.id] ?? true,
        })),
    [items, quantitiesToRefund, restockToggles],
  );

  const handleProcessRefund = useCallback(async () => {
    if (isSubmitting || itemsToRefund.length === 0 || !sale) return;
    if (!pin || managerId === '') {
      void import('react-hot-toast').then(({ default: toast }) =>
        toast.error(t('pos.toasts.managerPinRequired')),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const verifyRes = await apiClient.post('/employees/verify-pin', {
        manager_id: managerId,
        pin,
      });
      if (!verifyRes.data?.success) {
        toast.error(t('pos.toasts.invalidManagerPin'));
        setIsSubmitting(false);
        setPin('');
        return;
      }

      const payload = {
        manager_id: managerId,
        manager_pin: pin,
        reason: reason || 'Customer Return',
        refund_type: 'partial',
        idempotency_key: refundKey.current,
        items: itemsToRefund,
      };

      const response = await apiClient.post(`/pos/sales/${sale.id}/refund`, payload);
      if (response.data?.success) {
        toast.success(t('pos.toasts.refundSuccess'));
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
                id: reqItem.sale_item_id,
                product_name: origItem ? origItem.product_name : t('pos.refund'),
                quantity: reqItem.quantity,
                unit_price: -(refundBreakdown.lines[reqItem.sale_item_id] || 0) / reqItem.quantity,
                line_total: -(refundBreakdown.lines[reqItem.sale_item_id] || 0),
                discount: 0,
              };
            }),
          };
          openModal('pos_receipt_preview', { sale: refundSale });
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('pos.toasts.refundFailed'));
    } finally {
      setIsSubmitting(false);
      setPin('');
    }
  }, [
    itemsToRefund,
    sale,
    pin,
    managerId,
    reason,
    items,
    closeModal,
    openModal,
    t,
    isSubmitting,
    refundBreakdown.lines,
  ]);

  const handleVoidSale = async () => {
    if (isSubmitting || !sale) return;
    if (!pin || managerId === '') {
      void import('react-hot-toast').then(({ default: toast }) =>
        toast.error(t('pos.toasts.managerPinRequired')),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const verifyRes = await apiClient.post('/employees/verify-pin', {
        manager_id: managerId,
        pin,
      });
      if (!verifyRes.data?.success) {
        toast.error(t('pos.toasts.invalidManagerPin'));
        setIsSubmitting(false);
        setPin('');
        return;
      }

      const response = await apiClient.post(`/pos/sales/${sale.id}/void`, {
        manager_id: managerId,
        manager_pin: pin,
        reason: reason || 'Void Sale',
      });

      if (response.data?.success) {
        toast.success(t('pos.toasts.voidSuccess'));
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
            items: items
              .map((origItem: any) => ({
                product_name: origItem.product_name,
                quantity: origItem.quantity - (origItem.refunded_quantity || 0),
                unit_price: origItem.unit_price,
                line_total:
                  (origItem.quantity - (origItem.refunded_quantity || 0)) * origItem.unit_price,
                discount: 0,
              }))
              .filter((i: any) => i.quantity > 0),
          };
          openModal('pos_receipt_preview', { sale: voidSale });
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('pos.toasts.voidFailed'));
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
          void handleProcessRefund();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedRowIndex((prev) => Math.min(items.length - 1, prev + 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedRowIndex((prev) => Math.max(0, prev - 1));
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
              setRestockToggles((prev) => ({ ...prev, [item.id]: isRestock }));
            }
          }
          break;
        }
        case 'Enter':
          e.preventDefault();
          void handleProcessRefund();
          break;
        case 'Escape':
          e.preventDefault();
          closeModal('pos_refund');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, focusedRowIndex, quantitiesToRefund, reason, closeModal, handleProcessRefund]);

  if (!isOpen || !sale) return null;

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-foreground">
      <div className="absolute inset-0" onClick={() => closeModal('pos_refund')} />
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-title"
        className="w-full max-w-4xl bg-card border border-border/40 rounded-3xl shadow-2xl shadow-black/20 relative z-10 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-border/40 bg-muted/20">
          <div className="flex items-center space-x-3.5">
            <div className="p-2 bg-warning/10 rounded-xl border border-warning/20 text-warning shadow-sm">
              <RefreshCcw className="w-5 h-5" />
            </div>
            <h2 id="refund-title" className="text-xl font-semibold tracking-tight text-foreground">
              {t('pos.refundVoidSaleHeader').replace('{receipt}', sale.receipt_number)}
            </h2>
          </div>
          <button
            onClick={() => closeModal('pos_refund')}
            className="text-secondary hover:text-foreground p-2 rounded-xl hover:bg-card border border-transparent hover:border-border/60 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6 custom-scrollbar bg-muted/5">
          <div className="flex justify-between items-center bg-card p-5 rounded-lg border border-border/60 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary mb-1">
                {t('pos.saleTotal')}
              </p>
              <p className="text-2xl font-semibold text-foreground tabular-nums">
                {Number(sale.total).toFixed(2)}{' '}
                <span className="text-sm text-secondary ml-0.5">{t('pos.currency')}</span>
              </p>
            </div>
            {isEligibleForVoid && (
              <button
                onClick={handleVoidSale}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-danger hover:bg-danger/90 text-white rounded-xl font-bold flex items-center space-x-2 transition-all shadow-md shadow-danger/20 hover:shadow-danger/30 hover:-translate-y-0.5"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>{t('pos.voidEntireSale')}</span>
              </button>
            )}
          </div>

          <div className="bg-card border border-border/60 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-muted/40 backdrop-blur-md">
                <tr className="border-b border-border/60 text-[11px] font-semibold text-secondary uppercase tracking-wide">
                  <th className="py-4 px-5">{t('pos.productLabel')}</th>
                  <th className="py-4 px-5 text-center">{t('pos.price')}</th>
                  <th className="py-4 px-5 text-center">{t('pos.sold')}</th>
                  <th className="py-4 px-5 text-center">{t('pos.returned')}</th>
                  <th className="py-4 px-5 text-center">{t('pos.returnQty')}</th>
                  <th className="py-4 px-5 text-center">{t('pos.restockQ')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {items.map((item: any, index: number) => {
                  const refundable = Number(item.quantity) - Number(item.refunded_quantity || 0);
                  const isRestock = restockToggles[item.id] ?? true;
                  const isFocused = index === focusedRowIndex;

                  return (
                    <tr
                      key={item.id}
                      className={`group transition-colors ${isFocused ? 'bg-primary/5 relative after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-primary' : 'hover:bg-primary/[0.02]'}`}
                    >
                      <td className="py-4 px-5">
                        <div className="font-bold text-foreground text-sm">{item.product_name}</div>
                        <div className="text-[10px] text-secondary font-mono tracking-wider mt-1">
                          {item.barcode}
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center font-medium tabular-nums text-foreground">
                        {(Number(item.line_total) / Number(item.quantity)).toFixed(2)}{' '}
                        <span className="text-[10px] text-secondary ml-0.5">
                          {t('pos.currency')}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center font-medium text-foreground">
                        {item.quantity}
                      </td>
                      <td className="py-4 px-5 text-center font-bold text-warning">
                        {item.refunded_quantity || 0}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex justify-center">
                          <input
                            type="number"
                            min="0"
                            max={refundable}
                            step="0.01"
                            disabled={refundable <= 0}
                            value={quantitiesToRefund[item.id] || ''}
                            onChange={(e) => handleQtyChange(item.id, refundable, e.target.value)}
                            className="w-20 bg-card border border-border/60 rounded-lg text-center py-2 text-foreground font-bold shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                            placeholder="0"
                          />
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex justify-center">
                          <button
                            disabled={refundable <= 0}
                            onClick={() => handleRestockToggle(item.id)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide border transition-all disabled:opacity-50 shadow-sm ${isRestock ? 'bg-success/10 hover:bg-success/20 text-success border-success/30' : 'bg-danger/10 hover:bg-danger/20 text-danger border-danger/30'}`}
                          >
                            {isRestock ? t('pos.restock') : t('pos.writeoff')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-secondary mb-2">
              {t('pos.reasonForReversal')}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('pos.placeholderRefundReason')}
              className="w-full bg-card border border-border/60 rounded-xl py-3.5 px-4 text-foreground text-sm font-medium shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/50"
            />
          </div>
        </div>

        <div className="p-6 border-t border-border/40 bg-muted/10">
          <InlineManagerApproval
            managerId={managerId}
            setManagerId={setManagerId}
            pin={pin}
            setPin={setPin}
            isSubmitting={isSubmitting}
            contextMetadata={
              <>
                <div className="text-lg font-semibold tracking-tight">
                  {itemsToRefund.length > 0
                    ? t('pos.refundValueLabel')
                        .replace('{amount}', refundTotal.toFixed(2))
                        .replace('{currency}', t('pos.currency'))
                    : t('pos.selectItemsToRefund')}
                </div>
                {itemsToRefund.length > 0 && (
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-wide mt-1 ${itemsToRefund.some((i: any) => !i.restock_inventory) ? 'text-danger' : 'text-success'}`}
                  >
                    {itemsToRefund.some((i: any) => !i.restock_inventory)
                      ? t('pos.writeOffDamage')
                      : t('pos.restock')}
                  </div>
                )}
              </>
            }
          />
          <div className="mt-6 flex items-center justify-between font-bold">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-secondary flex space-x-3 items-center opacity-70">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-card rounded border border-border/60 font-mono">
                  ↑/↓
                </kbd>{' '}
                {t('pos.kbdNavigate')}
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-card rounded border border-border/60 font-mono">
                  ←/→
                </kbd>{' '}
                {t('pos.quantity')}
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-card rounded border border-border/60 font-mono">
                  Space
                </kbd>{' '}
                /{' '}
                <kbd className="px-1.5 py-0.5 bg-card rounded border border-border/60 font-mono">
                  R
                </kbd>{' '}
                /{' '}
                <kbd className="px-1.5 py-0.5 bg-card rounded border border-border/60 font-mono">
                  W
                </kbd>{' '}
                {t('pos.kbdToggle')}
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-card rounded border border-border/60 font-mono">
                  Enter
                </kbd>{' '}
                {t('pos.submit')}
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-card rounded border border-border/60 font-mono">
                  Esc
                </kbd>{' '}
                {t('common.cancel')}
              </span>
            </div>
            <button
              onClick={handleProcessRefund}
              disabled={refundTotal <= 0 || isSubmitting}
              className="px-8 py-3.5 bg-warning hover:bg-warning/90 text-warning-foreground font-semibold uppercase tracking-wide text-[11px] rounded-xl shadow-md shadow-warning/20 hover:shadow-lg hover:shadow-warning/30 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 transition-all"
            >
              {isSubmitting ? t('pos.processing') : t('pos.processRefund')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default RefundModal;
