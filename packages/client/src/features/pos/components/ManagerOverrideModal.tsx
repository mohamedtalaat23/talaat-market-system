import { useEffect, useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import toast from 'react-hot-toast';
import { usePOSStore } from '../usePOSStore';

export function ManagerOverrideModal() {
  const isOpen = useModalStore((state) => state.activeModals.pos_manager_override);
  const payload = useModalStore((state) => state.modalPayloads.pos_manager_override);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const closeModal = () => closeModalAction('pos_manager_override');
  
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const actionMap: Record<string, string> = {
    void_transaction: 'Void Transaction',
    large_discount: 'Apply Large Discount (>20%)',
    price_override: 'Manual Price Override',
    cross_cashier_resume: 'Resume Another Cashier\'s Cart',
    force_close_shift: 'Force Close Shift (Discrepancy/Pending)',
    reprint_receipt: 'Reprint Past Receipt'
  };

  const actionName = actionMap[payload?.action] || 'Restricted Action';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setIsSubmitting(true);
    // Phase 4 simulation: Real implementation validates PIN with API
    setTimeout(() => {
      setIsSubmitting(false);
      if (pin === '1234') { // Dummy PIN
        toast.success('Manager override approved');
        const state = usePOSStore.getState();

        if (payload?.onSuccess) {
           payload.onSuccess();
        } else if (payload?.action === 'void_transaction') {
           state.clearCart();
           toast.error('Transaction Voided');
        } else if (payload?.action === 'large_discount') {
           if (payload.target === 'cart') {
             state.setGlobalDiscount(payload.discountValue);
           } else {
             state.updateItemDiscount(payload.cartId, payload.discountValue);
           }
           toast.success('Large Discount Applied');
        } else if (payload?.action === 'cross_cashier_resume') {
           state.resumeCart(payload.holdId);
           toast.success('Cross-Cashier Cart Resumed');
        }

        setPin('');
        closeModal();
      } else {
        toast.error('Invalid Manager PIN');
        setPin('');
      }
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={isSubmitting ? undefined : closeModal} aria-hidden="true" />

      <div
        ref={focusTrapRef}
        className="w-full max-w-sm rounded-lg border border-red-900 bg-slate-900 p-6 shadow-2xl relative z-10 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="override-modal-title"
      >
        <div className="flex flex-col items-center justify-center pb-4 mb-4 border-b border-slate-800">
          <ShieldAlert size={48} className="text-red-500 mb-2" />
          <h3 id="override-modal-title" className="text-xl font-bold text-white text-center">
            Manager Authorization Required
          </h3>
          <p className="text-slate-400 text-sm mt-1 text-center">{actionName}</p>
        </div>
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 rounded-md p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <X size={18} />
        </button>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pin-input" className="block text-sm font-medium text-slate-300 mb-1">
              Enter Manager PIN
            </label>
            <input
              id="pin-input"
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={4}
              disabled={isSubmitting}
              className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-center text-3xl tracking-[1em] text-white placeholder-slate-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || pin.length < 4}
            className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 rounded font-bold text-white transition-colors"
          >
            {isSubmitting ? 'Verifying...' : 'Authorize Action'}
          </button>
        </form>
      </div>
    </div>
  );
}
