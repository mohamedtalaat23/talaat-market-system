import React, { useMemo } from 'react';
import type { POSCartItem } from '../usePOSStore';
import { usePOSStore } from '../usePOSStore';
import { useModalStore } from '@/stores/modalStore';
import { bankersRound } from '@/utils/currency';
import { useTranslation } from '@/hooks/useTranslation';

interface POSSummaryProps {
  cart: POSCartItem[];
  paymentMethod: string;
  cashReceived: number;
}

export const POSSummary = React.memo(({ cart, paymentMethod, cashReceived }: POSSummaryProps) => {
  const { t } = useTranslation();
  const openModal = useModalStore((state) => state.openModal);
  const selectedCustomer = usePOSStore((state) => state.selectedCustomer);
  const selectCustomer = usePOSStore((state) => state.selectCustomer);
  const globalDiscount = usePOSStore((state) => state.globalDiscount);
  const heldCarts = usePOSStore((state) => state.heldCarts);

  const activeItemIndex = usePOSStore((state) => state.activeItemIndex);
  const removeItem = usePOSStore((state) => state.removeItem);

  const { rawSubtotal, rawDiscount } = useMemo(
    () => ({
      rawSubtotal: cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
      rawDiscount: cart.reduce((sum, item) => sum + item.discount, 0),
    }),
    [cart],
  );

  const subtotal = bankersRound(rawSubtotal);
  const itemDiscounts = bankersRound(rawDiscount);
  const total = bankersRound(subtotal - itemDiscounts - globalDiscount);

  const activeItem = cart[activeItemIndex];

  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const appliedDiscountsCount = cart.filter((item) => item.discount > 0).length + (globalDiscount > 0 ? 1 : 0);

  const handleRemoveActiveItem = () => {
    if (activeItem) {
      removeItem(activeItem.cart_id);
    }
  };

  return (
    <div className="flex flex-col h-full justify-between font-sans bg-neutral-950 p-4 space-y-4 border-l border-border select-none overflow-hidden">
      
      {/* ── Top Section: Customer & Metadata ── */}
      <div className="bg-neutral-900 rounded border border-border p-3 flex flex-col justify-between shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
            {t('pos.cartCustomer')}
          </span>
          <div className="flex gap-2 items-center">
            {selectedCustomer && (
              <button
                type="button"
                onClick={() => selectCustomer(null)}
                className="text-[10px] font-bold text-danger hover:text-danger/80 focus:outline-none transition-colors"
                title={t('pos.disconnectCustomer')}
              >
                [REMOVE]
              </button>
            )}
            <button
              type="button"
              onClick={() => openModal('pos_customer_select')}
              className="text-[10px] font-bold text-secondary hover:text-foreground focus:outline-none transition-colors"
            >
              [F7 EDIT]
            </button>
          </div>
        </div>

        {selectedCustomer ? (
          <div className="flex flex-col mb-3">
            <span className="font-bold text-foreground text-sm truncate uppercase tracking-wide">
              {selectedCustomer.name}
            </span>
            <div className="flex items-center justify-between text-xs mt-1 text-secondary font-mono">
              <span>{selectedCustomer.phone || t('customers.phone')}</span>
              <span
                className={`font-semibold ${
                  selectedCustomer.balance < 0
                    ? 'text-danger'
                    : selectedCustomer.balance > 0
                      ? 'text-success'
                      : 'text-secondary'
                }`}
              >
                Credit: {Number(selectedCustomer.balance).toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between py-1 mb-3">
            <span className="text-sm font-bold uppercase tracking-wide text-neutral-500">
              {t('pos.walkIn')}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] font-mono border-t border-border pt-2 text-secondary">
          <div className="flex gap-3">
            <span>Items: {totalItemsCount}</span>
            <span>Discounts: {appliedDiscountsCount}</span>
          </div>
          <button 
            onClick={() => openModal('pos_suspended_carts')}
            className="font-bold hover:text-foreground transition-colors focus:outline-none"
          >
            Suspended ({heldCarts.length})
          </button>
        </div>
      </div>

      {/* ── Middle Section: Item Actions ── */}
      <div className="bg-neutral-900 rounded border border-border p-3 shrink-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
          Selected Item Actions
        </div>
        <div className="mb-2 text-sm font-bold text-foreground truncate">
          {activeItem ? `> ${activeItem.name} (x${activeItem.quantity})` : 'No item selected'}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => activeItem && openModal('pos_quantity')}
            disabled={!activeItem}
            className="h-10 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-secondary hover:text-foreground font-bold text-[11px] uppercase tracking-wider border border-border rounded transition-colors focus:outline-none"
          >
            [F2] QTY
          </button>
          <button
            onClick={() => activeItem && openModal('pos_discount')}
            disabled={!activeItem}
            className="h-10 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-secondary hover:text-foreground font-bold text-[11px] uppercase tracking-wider border border-border rounded transition-colors focus:outline-none"
          >
            [F3] DISC
          </button>
          <button
            onClick={handleRemoveActiveItem}
            disabled={!activeItem}
            className="h-10 bg-neutral-950 hover:bg-danger/20 disabled:opacity-50 text-secondary hover:text-danger font-bold text-[11px] uppercase tracking-wider border border-border rounded transition-colors focus:outline-none"
          >
            [DEL] REMOVE
          </button>
        </div>
      </div>

      {/* ── Cart Actions Grid ── */}
      <div className="bg-neutral-900 rounded border border-border p-3 shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => openModal('pos_transaction_search')}
            className="h-12 bg-neutral-950 hover:bg-neutral-800 text-secondary hover:text-foreground font-bold text-xs uppercase tracking-wider border border-border rounded transition-colors focus:outline-none"
          >
            [F4] PAST SALES
          </button>
          <button
            onClick={() => openModal('pos_manager_override', { action: 'clear_cart' })}
            className="h-12 bg-neutral-950 hover:bg-neutral-800 text-secondary hover:text-foreground font-bold text-xs uppercase tracking-wider border border-border rounded transition-colors focus:outline-none"
          >
            [F8] CLEAR CART
          </button>
          <button
            onClick={() => openModal('pos_suspended_carts')}
            className="h-12 bg-neutral-950 hover:bg-neutral-800 text-secondary hover:text-foreground font-bold text-xs uppercase tracking-wider border border-border rounded transition-colors focus:outline-none"
          >
            [F6] SUSPEND
          </button>
          <button
            onClick={() => {
              if (window.electronAPI) {
                window.electronAPI.openCashDrawer().catch(console.error);
              }
            }}
            className="h-12 bg-neutral-950 hover:bg-neutral-800 text-secondary hover:text-foreground font-bold text-xs uppercase tracking-wider border border-border rounded transition-colors focus:outline-none"
          >
            DRAWER
          </button>
        </div>
      </div>

      {/* ── Bottom Section: Financials & Pay ── */}
      <div className="flex-1 min-h-0 flex flex-col justify-end">
        <div className="bg-neutral-900 border border-border rounded p-4 space-y-2 select-none mb-4 flex-1 flex flex-col">
          <div className="flex justify-between text-sm text-secondary font-mono">
            <span>{t('pos.subtotal')}</span>
            <span>EGP {subtotal.toFixed(2)}</span>
          </div>
          {itemDiscounts > 0 && (
            <div className="flex justify-between text-sm text-success font-mono">
              <span>Item Discounts</span>
              <span>- EGP {itemDiscounts.toFixed(2)}</span>
            </div>
          )}
          {globalDiscount > 0 && (
            <div className="flex justify-between text-sm text-success font-mono">
              <span>{t('pos.globalDiscount')}</span>
              <span>- EGP {globalDiscount.toFixed(2)}</span>
            </div>
          )}
          
          <div className="flex-1" />

          {/* Giant Grand Total */}
          <div className="border-t border-border pt-4 mt-auto">
            <div className="flex flex-col items-end">
              <span className="text-5xl font-black font-mono text-foreground tracking-tighter select-none">
                <span className="text-xl text-secondary font-sans font-bold uppercase tracking-widest mr-3 relative -top-3">EGP</span>
                {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Pay Persistent Row ── */}
        <div className="shrink-0 select-none">
          <button
            onClick={() => openModal('pos_payment')}
            className="w-full h-16 bg-success hover:bg-success/90 rounded text-neutral-50 font-black uppercase text-xl tracking-widest transition-colors focus:outline-none shadow-md flex items-center justify-center gap-4"
          >
            <span>{t('pos.payAction')}</span>
            <span className="text-success-900/50 text-sm tracking-normal">[SPACE]</span>
          </button>
        </div>
      </div>
    </div>
  );
});

POSSummary.displayName = 'POSSummary';

