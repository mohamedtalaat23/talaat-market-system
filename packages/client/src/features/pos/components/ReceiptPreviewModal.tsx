import { useEffect, useCallback } from 'react';
import { X, Printer, CheckCircle } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { apiClient } from '@/services/api-client';
import { printerService } from '../services/printer.service';
import { useLANStore } from '../stores/useLANStore';
import toast from 'react-hot-toast';

export function ReceiptPreviewModal() {
  const isOpen = useModalStore((state) => state.activeModals.pos_receipt_preview);
  const payload = useModalStore((state) => state.modalPayloads.pos_receipt_preview);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const closeModal = () => closeModalAction('pos_receipt_preview');

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);
  const sale = payload?.sale;

  const handlePrint = useCallback(async () => {
    if (!sale) return;
    try {
      await printerService.printReceipt(sale);
      
      const { status } = useLANStore.getState();
      // Mark as printed on the backend - only post if online and ID is positive
      if (sale.id > 0 && status === 'online') {
        await apiClient.post(`/pos/receipts/${sale.id}/print`);
      }
      
      toast.success('Receipt printed successfully');
      closeModal();
    } catch (error) {
      console.error('Printing error:', error);
      toast.error('Printing failed. Receipt remains pending print.');
      closeModal();
    }
  }, [sale, closeModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handlePrint();
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrint]);

  if (!isOpen || !payload?.sale) return null;

  const globalDiscount = Number(sale.global_discount) || 0;
  const subtotal = Number(sale.subtotal) || 0;
  const itemDiscounts = Number(sale.discount_amount) || 0;
  const total = Number(sale.total) || 0;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={closeModal} aria-hidden="true" />

      <div
        ref={focusTrapRef}
        className="w-full max-w-sm bg-white text-black p-8 shadow-2xl relative z-10 animate-fade-in font-mono text-sm"
        role="dialog"
      >
        <button
          onClick={closeModal}
          className="absolute -top-12 right-0 text-white hover:text-emerald-400 transition-colors"
        >
          <X size={32} />
        </button>

        <div className="text-center mb-6">
          <CheckCircle size={48} className="mx-auto text-emerald-600 mb-2" />
          <h2 className="text-2xl font-bold uppercase tracking-widest">Talaat Market</h2>
          <p className="text-gray-500 mt-1">123 Supermarket St, Cairo</p>
          <p className="text-gray-500">Tel: +20 123 456 7890</p>
        </div>

        <div className="border-b border-dashed border-gray-400 pb-2 mb-4 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>Receipt:</span>
            <span>{sale.receipt_number}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{new Date(sale.created_at).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier ID:</span>
            <span>{sale.cashier_id}</span>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {sale.items && sale.items.map((item: any) => (
            <div key={item.id} className="text-xs">
              <div className="font-bold">{item.product_name}</div>
              <div className="flex justify-between text-gray-700">
                <span>{item.quantity} x EGP {Number(item.unit_price).toFixed(2)}</span>
                <span>EGP {Number(item.line_total).toFixed(2)}</span>
              </div>
              {Number(item.discount) > 0 && (
                <div className="text-right text-red-600">
                  - EGP {Number(item.discount).toFixed(2)}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-gray-400 pt-2 space-y-1 mb-6">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>EGP {subtotal.toFixed(2)}</span>
          </div>
          {(itemDiscounts > 0 || globalDiscount > 0) && (
            <div className="flex justify-between text-red-600">
              <span>Discounts</span>
              <span>- EGP {(itemDiscounts + globalDiscount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg mt-2">
            <span>TOTAL</span>
            <span>EGP {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="border-t border-b border-dashed border-gray-400 py-2 mb-6 space-y-1 text-gray-600">
          <div className="flex justify-between">
            <span>Payment ({sale.payment_method})</span>
            <span>EGP {Number(sale.cash_received || total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Change</span>
            <span>EGP {Number(sale.change_given || 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="text-center">
          <p className="font-bold mb-1">Thank you for shopping!</p>
          <div className="inline-flex items-center space-x-1 text-gray-400 mt-4 px-3 py-1 bg-gray-100 rounded-full border border-gray-200 cursor-pointer hover:bg-gray-200 hover:text-emerald-600 transition-colors" onClick={handlePrint}>
            <Printer size={14} />
            <span className="text-xs font-sans">Print (Enter)</span>
          </div>
        </div>
        
        {/* Helper text for cashier */}
        <div className="absolute -bottom-10 left-0 right-0 text-center text-white/50 text-sm font-sans">
          Press ENTER to print and continue
        </div>
      </div>
    </div>
  );
}
