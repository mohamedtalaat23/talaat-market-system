import { useEffect, useMemo, memo } from 'react';
import { X, Clock, User as UserIcon } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { usePOSStore } from '../usePOSStore';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

interface SuspendedCartItemProps {
  cart: any; // Using any or specific type if available
  onDiscard: (holdId: string, cashierId: number) => void;
  onResume: (holdId: string, cashierId: number) => void;
}

const SuspendedCartItem = memo(({ cart, onDiscard, onResume }: SuspendedCartItemProps) => {
  const { total } = useMemo(() => {
    const sub = cart.cart.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unit_price - item.discount,
      0,
    );
    return { total: sub - cart.globalDiscount };
  }, [cart]);

  return (
    <div className="bg-card-hover/50 rounded border border-border p-4 flex justify-between items-center">
      <div>
        <div className="flex items-center space-x-2 text-sm text-secondary mb-1">
          <Clock size={14} />
          <span>{new Date(cart.timestamp).toLocaleTimeString()}</span>
          <span className="px-2 text-muted">|</span>
          <UserIcon size={14} />
          <span>Cashier ID: {cart.cashier_id}</span>
        </div>
        <div className="font-bold text-foreground text-lg">
          {cart.cart.length} {cart.cart.length === 1 ? 'item' : 'items'}
          <span className="text-secondary font-normal ml-2">Total: EGP {total.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => onDiscard(cart.hold_id, cart.cashier_id)}
          className="px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded transition-colors"
        >
          Discard
        </button>
        <button
          onClick={() => onResume(cart.hold_id, cart.cashier_id)}
          className="px-6 py-2 bg-warning/90 hover:bg-warning text-white font-bold rounded transition-colors"
        >
          Resume
        </button>
      </div>
    </div>
  );
});

export function SuspendedCartsModal() {
  const isOpen = useModalStore((state) => state.activeModals.pos_suspended_carts);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const openModalAction = useModalStore((state) => state.openModal);
  const closeModal = () => closeModalAction('pos_suspended_carts');

  const heldCarts = usePOSStore((state) => state.heldCarts);
  const resumeCart = usePOSStore((state) => state.resumeCart);
  const removeHeldCart = usePOSStore((state) => state.removeHeldCart);

  const user = useAuthStore((state) => state.user);

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleResume = (holdId: string, cashierId: number) => {
    if (user?.id !== cashierId && user?.role !== 'admin' && user?.role !== 'manager') {
      closeModal();
      openModalAction('pos_manager_override', {
        action: 'cross_cashier_resume',
        holdId,
      });
      return;
    }

    // Clear current cart if we resume
    const currentCartLength = usePOSStore.getState().cart.length;
    if (currentCartLength > 0) {
      if (!window.confirm('You have an active cart. Resuming will overwrite it. Proceed?')) {
        return;
      }
    }

    resumeCart(holdId);
    toast.success('Suspended cart resumed');
    closeModal();
  };

  const handleDiscard = (holdId: string, cashierId: number) => {
    if (user?.id !== cashierId && user?.role !== 'admin' && user?.role !== 'manager') {
      toast.error("Only managers can discard other cashiers' suspended carts");
      return;
    }
    if (window.confirm('Are you sure you want to permanently delete this suspended cart?')) {
      removeHeldCart(holdId);
      toast.success('Suspended cart discarded');
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={closeModal} aria-hidden="true" />

      <div
        ref={focusTrapRef}
        className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-2xl relative z-10 animate-fade-in flex flex-col max-h-[80vh]"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
            <Clock size={24} className="text-warning" />
            <span>Suspended Carts</span>
          </h3>
          <button
            onClick={closeModal}
            className="text-secondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {heldCarts.length === 0 ? (
            <div className="py-12 text-center text-secondary">
              <p>No suspended carts found.</p>
            </div>
          ) : (
            heldCarts.map((cart) => (
              <SuspendedCartItem
                key={cart.hold_id}
                cart={cart}
                onDiscard={handleDiscard}
                onResume={handleResume}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
