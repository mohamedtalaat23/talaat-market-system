import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, CheckCircle } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { apiClient } from '@/services/api-client';
import { printerService } from '../services/printer.service';
import { useLANStore } from '../stores/useLANStore';
import toast from 'react-hot-toast';
import { useTranslation } from '@/hooks/useTranslation';

export function ReceiptPreviewModal() {
  const { t } = useTranslation();
  const isOpen = useModalStore((state) => state.activeModals.pos_receipt_preview);
  const payload = useModalStore((state) => state.modalPayloads.pos_receipt_preview);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const closeModal = useCallback(() => closeModalAction('pos_receipt_preview'), [closeModalAction]);

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);
  const sale = payload?.sale;

  const handlePrint = useCallback(async () => {
    if (!sale) return;
    try {
      await printerService.printReceipt(sale, Boolean(payload?.approval), payload?.approval);

      const { status } = useLANStore.getState();
      // Mark as printed on the backend - only post if online and ID is positive
      if (sale.id > 0 && status === 'online') {
        await apiClient.post(`/pos/receipts/${sale.id}/print`);
      }

      toast.success(t('pos.toasts.receiptPrinted'));
      closeModal();
    } catch (error) {
      console.error('Printing error:', error);
      toast.error(t('pos.toasts.printFailed'));
      closeModal();
    }
  }, [sale, payload?.approval, closeModal, t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void handlePrint();
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrint, closeModal]);

  if (!isOpen || !payload?.sale) return null;

  const globalDiscount = Number(sale.global_discount) || 0;
  const subtotal = Number(sale.subtotal) || 0;
  const itemDiscounts = Number(sale.discount_amount) || 0;
  const total = Number(sale.total) || 0;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={closeModal} aria-hidden="true" />

      <div
        ref={focusTrapRef}
        className="w-full max-w-sm bg-white text-black p-8 shadow-2xl relative z-10 animate-fade-in font-mono text-sm"
        role="dialog"
      >
        <button
          onClick={closeModal}
          className="absolute -top-12 right-0 text-white hover:text-success transition-colors"
        >
          <X size={32} />
        </button>

        <div className="text-center mb-6">
          <CheckCircle size={48} className="mx-auto text-success mb-2" />
          <h2 className="text-2xl font-bold uppercase tracking-wide">{t('login.talaatMarket')}</h2>
          <p className="text-secondary mt-1">123 Supermarket St, Cairo</p>
          <p className="text-secondary">Tel: +20 123 456 7890</p>
        </div>

        <div className="border-b border-dashed border-border pb-2 mb-4 text-xs text-muted">
          <div className="flex justify-between">
            <span>{t('pos.receiptNo')}</span>
            <span>{sale.receipt_number}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('pos.date')}</span>
            <span>{new Date(sale.created_at).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('pos.cashierId')}</span>
            <span>{sale.cashier_id}</span>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {sale.items &&
            sale.items.map((item: any) => (
              <div key={item.id} className="text-xs">
                <div className="font-bold">{item.product_name}</div>
                <div className="flex justify-between text-muted">
                  <span>
                    {item.quantity} x {Number(item.unit_price).toFixed(2)} {t('pos.currency')}
                  </span>
                  <span>
                    {Number(item.line_total).toFixed(2)} {t('pos.currency')}
                  </span>
                </div>
                {Number(item.discount) > 0 && (
                  <div className="text-right text-danger">
                    - {Number(item.discount).toFixed(2)} {t('pos.currency')}
                  </div>
                )}
              </div>
            ))}
        </div>

        <div className="border-t border-dashed border-border pt-2 space-y-1 mb-6">
          <div className="flex justify-between text-muted">
            <span>{t('pos.subtotal')}</span>
            <span>
              {subtotal.toFixed(2)} {t('pos.currency')}
            </span>
          </div>
          {(itemDiscounts > 0 || globalDiscount > 0) && (
            <div className="flex justify-between text-danger">
              <span>{t('pos.discounts')}</span>
              <span>
                - {(itemDiscounts + globalDiscount).toFixed(2)} {t('pos.currency')}
              </span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg mt-2">
            <span>{t('pos.totalUpperReceipt')}</span>
            <span>
              {total.toFixed(2)} {t('pos.currency')}
            </span>
          </div>
        </div>

        <div className="border-t border-b border-dashed border-border py-2 mb-6 space-y-1 text-muted">
          <div className="flex justify-between">
            <span>
              {t('pos.paymentMethod')} ({t('pos.' + sale.payment_method)})
            </span>
            <span>
              {Number(sale.cash_received || total).toFixed(2)} {t('pos.currency')}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{t('pos.change')}</span>
            <span>
              {Number(sale.change_given || 0).toFixed(2)} {t('pos.currency')}
            </span>
          </div>
        </div>

        <div className="text-center">
          <p className="font-bold mb-1">{t('pos.thankYou')}</p>
          <div
            className="inline-flex items-center space-x-1 text-secondary mt-4 px-3 py-1 bg-card rounded-full border border-border cursor-pointer hover:bg-card-hover hover:text-success transition-colors"
            onClick={handlePrint}
          >
            <Printer size={14} />
            <span className="text-xs font-sans">{t('pos.printEnter')}</span>
          </div>
        </div>

        {/* Helper text for cashier */}
        <div className="absolute -bottom-10 left-0 right-0 text-center text-white/50 text-sm font-sans">
          {t('pos.pressEnterToPrint')}
        </div>
      </div>
    </div>,
    document.body,
  );
}
