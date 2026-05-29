import { useEffect, useState, useRef } from 'react';
import { X, CreditCard, Banknote, CheckCircle2, Monitor } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { usePOSStore } from '../usePOSStore';
import { apiClient } from '@/services/api-client';
import { printerService } from '../services/printer.service';
import { useAuthStore } from '@/stores/authStore';
import { useLANStore } from '../stores/useLANStore';
import toast from 'react-hot-toast';
import { bankersRound } from '@/utils/currency';

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
  const selectedCustomer = usePOSStore((state) => state.selectedCustomer);
  
  const rawSubtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const rawDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  
  const subtotal = bankersRound(rawSubtotal);
  const itemDiscounts = bankersRound(rawDiscount);
  const total = bankersRound(subtotal - itemDiscounts - globalDiscount);

  const [cashReceivedStr, setCashReceivedStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashPortionStr, setCashPortionStr] = useState('');
  const [cardPortionStr, setCardPortionStr] = useState('');
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);
  const idempotencyKeyRef = useRef<string>('');

  // Focus and reset state when opened
  useEffect(() => {
    if (isOpen) {
      setCashReceivedStr('');
      setCashPortionStr(String(Math.floor(total / 2)));
      setCardPortionStr(String(total - Math.floor(total / 2)));
      idempotencyKeyRef.current = crypto.randomUUID();
    }
  }, [isOpen, total]);

  const handleCashPortionChange = (val: string) => {
    setCashPortionStr(val);
    const num = parseFloat(val) || 0;
    setCardPortionStr(String(Math.max(0, total - num)));
  };

  const handleCardPortionChange = (val: string) => {
    setCardPortionStr(val);
    const num = parseFloat(val) || 0;
    setCashPortionStr(String(Math.max(0, total - num)));
  };

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
  const canCheckout = cart.length > 0 && isValidAmount && !isSubmitting && (paymentMethod !== 'debt' || !!selectedCustomer);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCheckout) return;

    setIsSubmitting(true);
    const idempotency_key = idempotencyKeyRef.current || crypto.randomUUID(); // Fallback if ref is somehow empty
    const { mode, status, addOfflineSale, setStatus } = useLANStore.getState();

    const updateLocalShiftTally = (saleDataId: number) => {
      const activeShift = usePOSStore.getState().activeShift;
      if (activeShift) {
        let cashSalesAdd = 0;
        let cardSalesAdd = 0;
        if (paymentMethod === 'cash') cashSalesAdd = total;
        if (paymentMethod === 'card') cardSalesAdd = total;
        if (paymentMethod === 'split') {
          cashSalesAdd = parseFloat(cashPortionStr) || 0;
          cardSalesAdd = parseFloat(cardPortionStr) || 0;
        }

        const updatedShift = {
          ...activeShift,
          cash_sales: Number(activeShift.cash_sales || 0) + cashSalesAdd,
          card_sales: Number(activeShift.card_sales || 0) + cardSalesAdd,
          total_discounts: Number(activeShift.total_discounts || 0) + itemDiscounts + globalDiscount
        };
        usePOSStore.getState().setActiveShift(updatedShift);
      }
    };

    const executeOfflineCheckout = () => {
      const activeShift = usePOSStore.getState().activeShift;
      const shiftId = activeShift?.id || 1;
      const registerId = usePOSStore.getState().registerId || 1;
      const cashierName = useAuthStore.getState().user?.full_name || useAuthStore.getState().user?.username || 'Cashier';
      
      const offlineUuid = crypto.randomUUID();
      const receiptNumber = `STR01-REG${String(registerId).padStart(2, '0')}-OFF-${offlineUuid.slice(0, 8).toUpperCase()}`;
      const saleId = Math.floor(Math.random() * -1000000); // Unique negative ID for offline sale representation

      const saleItems = cart.map((item, index) => ({
        id: Math.floor(Math.random() * -1000000) - index,
        sale_id: saleId,
        product_id: item.product_id,
        product_name: item.name,
        name_ar: item.name_ar,
        barcode: item.barcode,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        discount: item.discount,
        line_total: (item.quantity * item.unit_price) - item.discount
      }));

      const payload = {
        shift_id: shiftId,
        register_id: registerId,
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'cash' ? cashReceived : undefined,
        cash_amount: paymentMethod === 'split' ? (parseFloat(cashPortionStr) || 0) : undefined,
        card_amount: paymentMethod === 'split' ? (parseFloat(cardPortionStr) || 0) : undefined,
        idempotency_key,
        global_discount: globalDiscount,
        customer_id: selectedCustomer?.id || undefined,
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount
        }))
      };

      const saleData = {
        id: saleId,
        receipt_number: receiptNumber,
        cashier_name: cashierName,
        items: saleItems,
        subtotal,
        discount_amount: itemDiscounts,
        global_discount: globalDiscount,
        tax_amount: 0,
        total,
        cash_received: paymentMethod === 'cash' ? cashReceived : null,
        cash_amount: paymentMethod === 'split' ? (parseFloat(cashPortionStr) || null) : null,
        card_amount: paymentMethod === 'split' ? (parseFloat(cardPortionStr) || null) : null,
        change_given: changeDue > 0 ? changeDue : 0,
        payment_method: paymentMethod,
        created_at: new Date().toISOString(),
        is_offline: true,
        print_count: 0
      };

      // Spool locally to offline queue
      addOfflineSale({
        id: offlineUuid,
        idempotency_key,
        payload,
        saleData,
        timestamp: new Date().toISOString()
      });

      // Update running shift tally locally
      updateLocalShiftTally(saleId);

      toast.success('Offline checkout stored in local register queue', { icon: '💾', duration: 4000 });
      clearCart();
      closeModal();
      setLastSaleId(saleId);

      if (autoPrintReceipts) {
        toast.promise(
          printerService.printReceipt(saleData),
          {
            loading: 'Printing offline receipt...',
            success: 'Receipt printed successfully!',
            error: 'Failed to print receipt',
          }
        );
      } else {
        openModalAction('pos_receipt_preview', { sale: saleData });
      }
    };

    // Resilient offline/timeout bypass
    if (mode === 'client' && status === 'offline') {
      executeOfflineCheckout();
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        shift_id: usePOSStore.getState().activeShift?.id,
        register_id: usePOSStore.getState().registerId,
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'cash' ? cashReceived : undefined,
        cash_amount: paymentMethod === 'split' ? (parseFloat(cashPortionStr) || 0) : undefined,
        card_amount: paymentMethod === 'split' ? (parseFloat(cardPortionStr) || 0) : undefined,
        idempotency_key,
        global_discount: globalDiscount,
        customer_id: selectedCustomer?.id || undefined,
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

      // Update running shift tally locally
      updateLocalShiftTally(saleData.id);

      if (autoPrintReceipts) {
        toast.promise(
          printerService.printReceipt(saleData).then(() => {
            // Decoupled status update - only post if online and ID is positive
            if (saleData.id > 0 && status === 'online') {
              return apiClient.post(`/pos/receipts/${saleData.id}/print`);
            }
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
      const isNetworkError = !error.response || error.message?.includes('Network Error') || error.status === undefined || error.status >= 500;
      
      if (mode === 'client' && isNetworkError) {
        toast.error('Network connection to Master server failed. Routing to offline buffer...', { duration: 4000 });
        setStatus('offline');
        executeOfflineCheckout();
      } else {
        toast.error(error.response?.data?.message || error.message || 'Checkout failed.');
      }
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
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex-1 py-3 rounded border flex items-center justify-center space-x-1.5 transition-colors ${paymentMethod === 'cash' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
              >
                <Banknote size={20} />
                <span className="font-bold text-base">Cash</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex-1 py-3 rounded border flex items-center justify-center space-x-1.5 transition-colors ${paymentMethod === 'card' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
              >
                <CreditCard size={20} />
                <span className="font-bold text-base">Card</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('split')}
                className={`flex-1 py-3 rounded border flex items-center justify-center space-x-1.5 transition-colors ${paymentMethod === 'split' ? 'bg-amber-600/20 border-amber-500 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
              >
                <Monitor size={20} />
                <span className="font-bold text-base">Split</span>
              </button>
              <button
                type="button"
                disabled={!selectedCustomer}
                onClick={() => setPaymentMethod('debt')}
                className={`flex-1 py-3 rounded border flex items-center justify-center space-x-1.5 transition-colors ${
                  paymentMethod === 'debt'
                    ? 'bg-rose-600/20 border-rose-500 text-rose-400'
                    : selectedCustomer
                    ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                    : 'bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed border-dashed'
                }`}
                title={selectedCustomer ? 'Charge to customer account' : 'Select customer (F7) to use debt'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-bold text-base">Debt</span>
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

            {paymentMethod === 'split' && (
              <div className="space-y-4 bg-slate-950/60 p-4 border border-slate-800/80 rounded-lg">
                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Split Allocation (EGP)</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="cash-portion" className="block text-xs font-semibold text-slate-400 mb-1">Cash Portion</label>
                    <input
                      id="cash-portion"
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={isSubmitting}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
                      value={cashPortionStr}
                      onChange={(e) => handleCashPortionChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="card-portion" className="block text-xs font-semibold text-slate-400 mb-1">Card Portion</label>
                    <input
                      id="card-portion"
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={isSubmitting}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-lg font-bold text-white focus:outline-none focus:border-emerald-500"
                      value={cardPortionStr}
                      onChange={(e) => handleCardPortionChange(e.target.value)}
                    />
                  </div>
                </div>
                <div className="text-xs text-slate-500 text-center pt-2">
                  Verify Cash portion ({Number(cashPortionStr || 0).toFixed(2)}) + Card portion ({Number(cardPortionStr || 0).toFixed(2)}) equals total ({total.toFixed(2)})
                </div>
              </div>
            )}

            {paymentMethod === 'debt' && selectedCustomer && (
              <div className="space-y-4">
                <div className="p-4 rounded border bg-rose-950/20 border-rose-900/30 text-rose-300">
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-1">Buy on Credit (Debt Account)</div>
                  <p className="text-xs leading-relaxed text-slate-300">
                    The total sum of <strong className="text-rose-400 font-mono">EGP {total.toFixed(2)}</strong> will be charged to the account of <strong className="text-white">{selectedCustomer.name}</strong>. Their new outstanding balance will be <strong className="text-rose-400 font-mono">EGP {(Number(selectedCustomer.balance) - total).toFixed(2)}</strong>.
                  </p>
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
