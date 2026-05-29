import { useEffect, useState } from 'react';
import { X, Hash } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { usePOSStore } from '../usePOSStore';

export function QuantityModal() {
  const isOpen = useModalStore((state) => state.activeModals.pos_quantity);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const closeModal = () => {
    closeModalAction('pos_quantity');
    // Return focus to body so scanner continues to work
    document.body.focus();
  };

  const cart = usePOSStore((state) => state.cart);
  const activeItemIndex = usePOSStore((state) => state.activeItemIndex);
  const updateQuantity = usePOSStore((state) => state.updateQuantity);
  const removeItem = usePOSStore((state) => state.removeItem);

  const activeItem = cart[activeItemIndex];
  const [quantityStr, setQuantityStr] = useState('');

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (isOpen && activeItem) {
      setQuantityStr(String(activeItem.quantity));
    }
  }, [isOpen, activeItem]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !activeItem) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantityStr);
    if (isNaN(qty) || qty < 0) return;

    if (qty === 0) {
      removeItem(activeItem.cart_id);
    } else {
      updateQuantity(activeItem.cart_id, qty);
    }
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={closeModal} aria-hidden="true" />

      <div
        ref={focusTrapRef}
        className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl relative z-10 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quantity-modal-title"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-6">
          <h3 id="quantity-modal-title" className="text-xl font-bold text-white flex items-center space-x-2">
            <Hash size={24} className="text-emerald-500" />
            <span>Update Quantity</span>
          </h3>
          <button onClick={closeModal} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-lg">
            <div className="text-sm font-semibold text-slate-400 mb-1">Product</div>
            <div className="text-lg font-bold text-white truncate">{activeItem.name}</div>
            <div className="text-xs text-slate-500 mt-1">
              Current Stock: {activeItem.inventory_quantity} {activeItem.unit}
            </div>
          </div>

          <div>
            <label htmlFor="quantity-input" className="block text-sm font-medium text-slate-300 mb-1">
              New Quantity ({activeItem.unit})
            </label>
            <input
              id="quantity-input"
              autoFocus
              type="number"
              step="0.01"
              min={0}
              className="w-full bg-slate-950 border border-slate-700 rounded p-4 text-3xl font-bold text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              value={quantityStr}
              onChange={(e) => setQuantityStr(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={!quantityStr || isNaN(Number(quantityStr))}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 rounded font-bold text-white transition-colors text-lg"
          >
            Update Quantity
          </button>
        </form>
      </div>
    </div>
  );
}
