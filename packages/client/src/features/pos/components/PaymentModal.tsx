import { useEffect, useState } from 'react';
import { X, CreditCard, Banknote, CheckCircle2 } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { usePOSStore } from '../usePOSStore';
import { apiClient } from '@/services/api-client';
import { printerService } from '../services/printer.service';
import toast from 'react-hot-toast';

export function PaymentModal() {
  const isOpen = useModalStore((state) => state.activeModals.pos_payment);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const openModalAction = useModalStore((state) => state.openModal);
  const closeModal = () => closeModalAction('pos_payment');
  
  const cart = usePOSStore((state) => state.cart);
  const paymentMethod = usePOSStore((state) => state.paymentMethod);
  const setPaymentMethod = usePOSStore((state) => state.setPaymentMethod);
  const clearCart = usePOSStore((state) => state.clearCart);
  const globalDiscount = usePOSStore((state) => state.globalDiscount);
  const setLastSaleId = usePOSStore((state) => state.setLastSaleId);
  const autoPrintReceipts = usePOSStore((state) => state.autoPrintReceipts);
  
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const itemDiscounts = cart.reduce((sum, item) => sum + item.discount, 0);
  const total = subtotal - itemDiscounts - globalDiscount;

  const [cashReceivedStr, setCashReceivedStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Focus and reset state when opened
  useEffect(() => {
    if (isOpen) {
      setCashReceivedStr('');
    }
  }, [isOpen]);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) closeModal();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, closeModal]);

  if (!isOpen) return null;

  const cashReceived = parseFloat(cashReceivedStr) || 0;
  const changeDue = Math.max(0, cashReceived - total);
  
  // Validation for checkout
  const isValidAmount = paymentMethod !== 'cash' || cashReceived >= total;
  const canCheckout = cart.length > 0 && isValidAmount && !isSubmitting;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCheckout) return;

    setIsSubmitting(true);
    const idempotency_key = crypto.randomUUID();

    try {
      const payload = {
        shift_id: usePOSStore.getState().activeShift?.id,
        register_id: usePOSStore.getState().registerId,
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'cash' ? cashReceived : undefined,
        idempotency_key,
        global_discount: globalDiscount,
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount
        }))
      };

      const response = await apiClient.post('/pos/checkout', payload);
      
      toast.success('Checkout successful!', { icon: '🎉' });
      clearCart();
      closeModal();
      
      const saleData = response.data.data;
      setLastSaleId(saleData.id);

      if (autoPrintReceipts) {
        toast.promise(
          printerService.printReceipt(saleData).then(() => {
            // Decoupled status update
            return apiClient.post(`/pos/receipts/${saleData.id}/print`);
          }),
          {
            loading: 'Printing receipt...',
            success: 'Receipt printed successfully!',
            error: 'Failed to print receipt',
          }
        );
      } else {
        openModalAction('pos_receipt_preview', { sale: saleData });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Checkout failed. Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-4">
      <div className="absolute inset-0" onClick={isSubmitting ? undefined : closeModal} aria-hidden="true" />

      <div
        ref={focusTrapRef}
        className="w-full max-w-3xl rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl relative z-10 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-6">
          <h3 id="payment-modal-title" className="text-2xl font-bold text-white flex items-center space-x-2">
            <span>Checkout</span>
          </h3>
          <button
            onClick={closeModal}
            disabled={isSubmitting}
            className="rounded-md p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Left Column: Totals */}
          <div className="space-y-4">
            <div className="bg-slate-950 rounded-lg p-5 border border-slate-800">
              <div className="flex justify-between text-slate-400 mb-2 text-lg">
                <span>Subtotal</span>
                <span>EGP {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-400 mb-2 text-lg">
                <span>Discounts</span>
                <span>- EGP {(itemDiscounts + globalDiscount).toFixed(2)}</span>
              </div>
              <div className="w-full h-px bg-slate-800 my-4"></div>
              <div className="flex justify-between text-white text-4xl font-bold tracking-tight">
                <span>Total</span>
                <span>EGP {total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Payment Form */}
          <form onSubmit={handleCheckout} className="space-y-6">
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex-1 py-4 rounded border flex items-center justify-center space-x-2 transition-colors ${paymentMethod === 'cash' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
              >
                <Banknote size={24} />
                <span className="font-bold text-lg">Cash</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex-1 py-4 rounded border flex items-center justify-center space-x-2 transition-colors ${paymentMethod === 'card' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
              >
                <CreditCard size={24} />
                <span className="font-bold text-lg">Card</span>
              </button>
            </div>

            {paymentMethod === 'cash' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="cash-input" className="block text-sm font-medium text-slate-300 mb-1">
                    Cash Received (EGP)
                  </label>
                  <input
                    id="cash-input"
                    autoFocus
                    type="number"
                    step="0.01"
                    min={0}
                    disabled={isSubmitting}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-4 text-3xl font-bold text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    value={cashReceivedStr}
                    onChange={(e) => setCashReceivedStr(e.target.value)}
                  />
                </div>
                
                <div className={`p-4 rounded border ${changeDue > 0 ? 'bg-blue-900/20 border-blue-800 text-blue-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                  <div className="text-sm font-medium mb-1">Change Due</div>
                  <div className="text-4xl font-bold tracking-tight">EGP {changeDue.toFixed(2)}</div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!canCheckout}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 rounded font-bold text-white transition-colors text-xl flex items-center justify-center space-x-2 shadow-lg"
            >
              {isSubmitting ? (
                <span>Processing...</span>
              ) : (
                <>
                  <CheckCircle2 size={28} />
                  <span>Complete Sale (Enter)</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
