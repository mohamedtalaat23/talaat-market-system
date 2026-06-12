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

  const rawSubtotal = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
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
      setCashPortionStr('0');
      setCardPortionStr(String(total));
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

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        closeModal();
      } else if (e.key === 'F1') {
        e.preventDefault();
        setPaymentMethod('cash');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setPaymentMethod('card');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setPaymentMethod('split');
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, closeModal, setPaymentMethod]);

  if (!isOpen) return null;

  const cashReceived = parseFloat(cashReceivedStr) || 0;
  const changeDue = Math.max(0, cashReceived - total);

  // Validation for checkout
  const isValidAmount = paymentMethod !== 'cash' || cashReceived >= total;
  const canCheckout =
    cart.length > 0 &&
    isValidAmount &&
    !isSubmitting &&
    (paymentMethod !== 'debt' || !!selectedCustomer);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCheckout) return;

    setIsSubmitting(true);
    const idempotency_key = idempotencyKeyRef.current || crypto.randomUUID(); // Fallback if ref is somehow empty
    const { mode, status, addOfflineSale, setStatus } = useLANStore.getState();

    const updateLocalShiftTally = (saleDataId: string) => {
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
          total_discounts:
            Number(activeShift.total_discounts || 0) + itemDiscounts + globalDiscount,
        };
        usePOSStore.getState().setActiveShift(updatedShift);
      }
    };

    const executeOfflineCheckout = () => {
      const activeShift = usePOSStore.getState().activeShift;
      const shiftId = activeShift?.id || 1;
      const registerId = usePOSStore.getState().registerId || 1;
      const cashierName =
        useAuthStore.getState().user?.full_name ||
        useAuthStore.getState().user?.username ||
        'Cashier';

      const offlineUuid = crypto.randomUUID();
      const receiptNumber = `STR01-REG${String(registerId).padStart(2, '0')}-OFF-${offlineUuid.slice(0, 8).toUpperCase()}`;
      const saleId = offlineUuid;

      const saleItems = cart.map((item) => ({
        id: crypto.randomUUID(),
        sale_id: saleId,
        product_id: item.product_id,
        product_name: item.name,
        name_ar: item.name_ar,
        barcode: item.barcode,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        discount: item.discount,
        line_total: item.quantity * item.unit_price - item.discount,
      }));

      const offlineCreatedAt = new Date().toISOString();

      const payload = {
        id: saleId,
        receipt_number: receiptNumber,
        created_at: offlineCreatedAt,
        shift_id: shiftId,
        register_id: registerId,
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'cash' ? cashReceived : undefined,
        cash_amount: paymentMethod === 'split' ? parseFloat(cashPortionStr) || 0 : undefined,
        card_amount: paymentMethod === 'split' ? parseFloat(cardPortionStr) || 0 : undefined,
        idempotency_key,
        global_discount: globalDiscount,
        customer_id: selectedCustomer?.id || undefined,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
        })),
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
        cash_amount: paymentMethod === 'split' ? parseFloat(cashPortionStr) || null : null,
        card_amount: paymentMethod === 'split' ? parseFloat(cardPortionStr) || null : null,
        change_given: changeDue > 0 ? changeDue : 0,
        payment_method: paymentMethod,
        created_at: offlineCreatedAt,
        is_offline: true,
        print_count: 0,
      };

      // Spool locally to offline queue
      addOfflineSale({
        id: offlineUuid,
        idempotency_key,
        payload,
        saleData,
        timestamp: offlineCreatedAt,
      });

      // Update running shift tally locally
      updateLocalShiftTally(saleId);

      toast.success('Offline checkout stored in local register queue', {
        icon: '💾',
        duration: 4000,
      });
      clearCart();
      closeModal();
      setLastSaleId(saleId);

      if (autoPrintReceipts) {
        toast.promise(printerService.printReceipt(saleData), {
          loading: 'Printing offline receipt...',
          success: 'Receipt printed successfully!',
          error: 'Failed to print receipt',
        });
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
      const saleId = crypto.randomUUID();
      const payload = {
        id: saleId,
        shift_id: usePOSStore.getState().activeShift?.id,
        register_id: usePOSStore.getState().registerId,
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'cash' ? cashReceived : undefined,
        cash_amount: paymentMethod === 'split' ? parseFloat(cashPortionStr) || 0 : undefined,
        card_amount: paymentMethod === 'split' ? parseFloat(cardPortionStr) || 0 : undefined,
        idempotency_key,
        global_discount: globalDiscount,
        customer_id: selectedCustomer?.id || undefined,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
        })),
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
            // Decoupled status update - only post if online and not offline sale
            if (saleData.id && !saleData.is_offline && status === 'online') {
              return apiClient.post(`/pos/receipts/${saleData.id}/print`);
            }
          }),
          {
            loading: 'Printing receipt...',
            success: 'Receipt printed successfully!',
            error: 'Failed to print receipt',
          },
        );
      } else {
        openModalAction('pos_receipt_preview', { sale: saleData });
      }
    } catch (error: any) {
      const isNetworkError =
        !error.response ||
        error.message?.includes('Network Error') ||
        error.status === undefined ||
        error.status >= 500;

      if (mode === 'client' && isNetworkError) {
        toast.error('Network connection to Master server failed. Routing to offline buffer...', {
          duration: 4000,
        });
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
      <div
        className="absolute inset-0"
        onClick={isSubmitting ? undefined : closeModal}
        aria-hidden="true"
      />

      <div
        ref={focusTrapRef}
        className="w-full max-w-3xl rounded-lg border border-input-border bg-card p-6 shadow-2xl relative z-10 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
      >
        <div className="flex items-center justify-between border-b border-input-border pb-3 mb-6">
          <h3
            id="payment-modal-title"
            className="text-2xl font-bold text-input-text flex items-center space-x-2"
          >
            <span>Checkout</span>
          </h3>
          <button
            onClick={closeModal}
            disabled={isSubmitting}
            className="rounded-md p-1.5 text-secondary hover:text-input-text hover:bg-card-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Left Column: Totals */}
          <div className="space-y-4">
            <div className="bg-input-bg rounded-lg p-5 border border-input-border">
              <div className="flex justify-between text-secondary mb-2 text-lg">
                <span>Subtotal</span>
                <span>EGP {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-success mb-2 text-lg">
                <span>Discounts</span>
                <span>- EGP {(itemDiscounts + globalDiscount).toFixed(2)}</span>
              </div>
              <div className="w-full h-px bg-border my-4"></div>
              <div className="flex justify-between text-input-text text-4xl font-bold tracking-tight">
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
                className={`flex-1 py-3 rounded border flex items-center justify-center space-x-1.5 transition-colors ${paymentMethod === 'cash' ? 'bg-success/15 border-success text-success' : 'bg-card border-input-border text-secondary hover:bg-card-hover'}`}
              >
                <Banknote size={20} />
                <span className="font-bold text-base">Cash [F1]</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex-1 py-3 rounded border flex items-center justify-center space-x-1.5 transition-colors ${paymentMethod === 'card' ? 'bg-primary/15 border-primary text-primary' : 'bg-card border-input-border text-secondary hover:bg-card-hover'}`}
              >
                <CreditCard size={20} />
                <span className="font-bold text-base">Card [F2]</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('split')}
                className={`flex-1 py-3 rounded border flex items-center justify-center space-x-1.5 transition-colors ${paymentMethod === 'split' ? 'bg-warning/15 border-warning text-warning' : 'bg-card border-input-border text-secondary hover:bg-card-hover'}`}
              >
                <Monitor size={20} />
                <span className="font-bold text-base">Split [F3]</span>
              </button>
              <button
                type="button"
                disabled={!selectedCustomer}
                onClick={() => setPaymentMethod('debt')}
                className={`flex-1 py-3 rounded border flex items-center justify-center space-x-1.5 transition-colors ${
                  paymentMethod === 'debt'
                    ? 'bg-danger/15 border-danger text-danger'
                    : selectedCustomer
                      ? 'bg-card border-input-border text-secondary hover:bg-card-hover'
                      : 'bg-input-bg/20 border-input-border text-muted cursor-not-allowed border-dashed'
                }`}
                title={
                  selectedCustomer
                    ? 'Charge to customer account'
                    : 'Select customer (F7) to use debt'
                }
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-bold text-base">Debt</span>
              </button>
            </div>

            {paymentMethod === 'cash' && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="cash-input"
                    className="block text-sm font-medium text-secondary mb-1"
                  >
                    Cash Received (EGP)
                  </label>
                  <input
                    id="cash-input"
                    autoFocus
                    type="number"
                    step="0.01"
                    min={0}
                    disabled={isSubmitting}
                    className="w-full bg-input-bg border border-input-border rounded p-4 text-input-text font-bold placeholder:text-input-placeholder:text-input-text focus:outline-none focus:border-input-focus focus:ring-primary/20"
                    value={cashReceivedStr}
                    onChange={(e) => setCashReceivedStr(e.target.value)}
                  />
                </div>

                <div
                  className={`p-4 rounded border ${changeDue > 0 ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-input-bg/40 border-input-border text-secondary'}`}
                >
                  <div className="text-sm font-medium mb-1">Change Due</div>
                  <div className="text-4xl font-bold tracking-tight">
                    EGP {changeDue.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'split' && (
              <div className="space-y-4 bg-input-bg/45 p-4 border border-input-border rounded-lg">
                <div className="text-sm font-bold text-secondary uppercase tracking-wider mb-2">
                  Split Allocation (EGP)
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="cash-portion"
                      className="block text-xs font-semibold text-secondary mb-1"
                    >
                      Cash Portion
                    </label>
                    <input
                      id="cash-portion"
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={isSubmitting}
                      className="w-full bg-input-bg border border-input-border rounded px-3 py-2 text-lg font-bold text-input-text focus:outline-none focus:border-input-focus placeholder:text-input-placeholder focus:ring-1 focus:ring-primary/20"
                      value={cashPortionStr}
                      onChange={(e) => handleCashPortionChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="card-portion"
                      className="block text-xs font-semibold text-secondary mb-1"
                    >
                      Card Portion
                    </label>
                    <input
                      id="card-portion"
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={isSubmitting}
                      className="w-full bg-input-bg border border-input-border rounded px-3 py-2 text-lg font-bold text-input-text focus:outline-none focus:border-input-focus placeholder:text-input-placeholder focus:ring-1 focus:ring-primary/20"
                      value={cardPortionStr}
                      onChange={(e) => handleCardPortionChange(e.target.value)}
                    />
                  </div>
                </div>
                <div className="text-xs text-muted text-center pt-2">
                  Verify Cash portion ({Number(cashPortionStr || 0).toFixed(2)}) + Card portion (
                  {Number(cardPortionStr || 0).toFixed(2)}) equals total ({total.toFixed(2)})
                </div>
              </div>
            )}

            {paymentMethod === 'debt' && selectedCustomer && (
              <div className="space-y-4">
                <div className="p-4 rounded border bg-danger/10 border-danger/20 text-danger">
                  <div className="text-xs font-bold uppercase tracking-wider text-danger mb-1">
                    Buy on Credit (Debt Account)
                  </div>
                  <p className="text-xs leading-relaxed text-secondary">
                    The total sum of{' '}
                    <strong className="text-danger font-mono">EGP {total.toFixed(2)}</strong> will
                    be charged to the account of{' '}
                    <strong className="text-input-text">{selectedCustomer.name}</strong>. Their new
                    outstanding balance will be{' '}
                    <strong className="text-danger font-mono">
                      EGP {(Number(selectedCustomer.balance) - total).toFixed(2)}
                    </strong>
                    .
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!canCheckout}
              className="w-full py-5 bg-success hover:bg-success/90 disabled:bg-card-hover disabled:text-muted rounded font-bold text-white transition-colors text-xl flex items-center justify-center space-x-2 shadow-lg shadow-success/10"
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
