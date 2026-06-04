import { useEffect, useState } from 'react';
import { X, Tag } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { usePOSStore } from '../usePOSStore';
import toast from 'react-hot-toast';

export function DiscountModal() {
  const isOpen = useModalStore((state) => state.activeModals.pos_discount);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const openModalAction = useModalStore((state) => state.openModal);
  const closeModal = () => closeModalAction('pos_discount');

  const cart = usePOSStore((state) => state.cart);
  const activeItemIndex = usePOSStore((state) => state.activeItemIndex);
  const setGlobalDiscount = usePOSStore((state) => state.setGlobalDiscount);
  const updateItemDiscount = usePOSStore((state) => state.updateItemDiscount);

  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [target, setTarget] = useState<'item' | 'cart'>('item');
  const [amountStr, setAmountStr] = useState('');

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (isOpen) {
      setAmountStr('');
      setDiscountType('fixed');
      setTarget(cart.length > 0 && cart[activeItemIndex] ? 'item' : 'cart');
    }
  }, [isOpen, activeItemIndex, cart]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount < 0) return;

    let discountValue = amount;
    const activeItem = cart[activeItemIndex];

    if (target === 'item') {
      if (!activeItem) return toast.error('No item selected');
      const lineTotalBeforeDiscount = activeItem.quantity * activeItem.unit_price;

      if (discountType === 'percentage') {
        discountValue = lineTotalBeforeDiscount * (amount / 100);
      }

      if (discountValue > lineTotalBeforeDiscount) {
        return toast.error('Discount cannot exceed line total');
      }

      // Manager override required if discount > 20%
      if (discountValue > lineTotalBeforeDiscount * 0.2) {
        closeModal();
        openModalAction('pos_manager_override', {
          action: 'large_discount',
          target: 'item',
          cartId: activeItem.cart_id,
          discountValue,
        });
        return;
      }

      updateItemDiscount(activeItem.cart_id, discountValue);
      toast.success('Item discount applied');
      closeModal();
    } else {
      const cartSubtotal = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

      if (discountType === 'percentage') {
        discountValue = cartSubtotal * (amount / 100);
      }

      if (discountValue > cartSubtotal) {
        return toast.error('Discount cannot exceed cart subtotal');
      }

      if (discountValue > cartSubtotal * 0.2) {
        closeModal();
        openModalAction('pos_manager_override', {
          action: 'large_discount',
          target: 'cart',
          discountValue,
        });
        return;
      }

      setGlobalDiscount(discountValue);
      toast.success('Cart discount applied');
      closeModal();
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={closeModal} aria-hidden="true" />

      <div
        ref={focusTrapRef}
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-2xl relative z-10 animate-fade-in"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-border pb-3 mb-6">
          <h3 className="text-xl font-bold text-foreground flex items-center space-x-2">
            <Tag size={24} className="text-success" />
            <span>Apply Discount</span>
          </h3>
          <button
            onClick={closeModal}
            className="text-secondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex bg-background p-1 rounded border border-border">
            <button
              type="button"
              onClick={() => setTarget('item')}
              disabled={cart.length === 0}
              className={`flex-1 py-2 text-sm font-bold rounded transition-colors ${target === 'item' ? 'bg-card-hover text-foreground shadow-sm' : 'text-secondary hover:text-foreground'} disabled:opacity-50`}
            >
              Selected Item
            </button>
            <button
              type="button"
              onClick={() => setTarget('cart')}
              className={`flex-1 py-2 text-sm font-bold rounded transition-colors ${target === 'cart' ? 'bg-card-hover text-foreground shadow-sm' : 'text-secondary hover:text-foreground'}`}
            >
              Entire Cart
            </button>
          </div>

          <div className="flex bg-background p-1 rounded border border-border">
            <button
              type="button"
              onClick={() => setDiscountType('fixed')}
              className={`flex-1 py-2 text-sm font-bold rounded transition-colors ${discountType === 'fixed' ? 'bg-card-hover text-foreground shadow-sm' : 'text-secondary hover:text-foreground'}`}
            >
              Fixed Amount (EGP)
            </button>
            <button
              type="button"
              onClick={() => setDiscountType('percentage')}
              className={`flex-1 py-2 text-sm font-bold rounded transition-colors ${discountType === 'percentage' ? 'bg-card-hover text-foreground shadow-sm' : 'text-secondary hover:text-foreground'}`}
            >
              Percentage (%)
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Discount Amount {discountType === 'percentage' ? '(%)' : '(EGP)'}
            </label>
            <input
              autoFocus
              type="number"
              step="0.01"
              min={0}
              className="w-full bg-background border border-border rounded p-4 text-3xl font-bold text-foreground focus:border-success focus:ring-1 focus:ring-success"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={!amountStr || isNaN(Number(amountStr))}
            className="w-full py-4 bg-success hover:bg-success/90 disabled:bg-card-hover disabled:text-muted rounded font-bold text-white transition-colors text-lg"
          >
            Apply Discount
          </button>
        </form>
      </div>
    </div>
  );
}
