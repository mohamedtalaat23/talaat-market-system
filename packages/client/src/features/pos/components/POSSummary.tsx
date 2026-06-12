import React, { useMemo } from 'react';
import type { POSCartItem } from '../usePOSStore';
import { usePOSStore } from '../usePOSStore';
import { useModalStore } from '@/stores/modalStore';
import { bankersRound } from '@/utils/currency';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Hash,
  Percent,
  History,
  PauseCircle,
  Trash2,
  CreditCard,
  UserMinus,
  UserCog,
  Banknote,
} from 'lucide-react';

interface POSSummaryProps {
  cart: POSCartItem[];
  paymentMethod: string;
  cashReceived: number;
}

/** Compact key badge — shows the keyboard shortcut next to an action label */
function KbdBadge({ label }: { label: string }) {
  return (
    <kbd className="ms-auto text-xs font-mono font-semibold px-1 py-0.5 rounded bg-neutral-100 border border-border text-secondary leading-none select-none">
      {label}
    </kbd>
  );
}

/** A single action button in the Item Actions or Cart Actions panels */
interface ActionBtnProps {
  label: string;
  kbd: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  fullWidth?: boolean;
}
function ActionBtn({ label, kbd, icon, onClick, disabled, destructive, fullWidth }: ActionBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center gap-2 px-3 h-10 rounded border transition-colors focus:outline-none',
        fullWidth ? 'w-full' : '',
        disabled
          ? 'opacity-40 cursor-not-allowed border-border bg-neutral-50 text-neutral-400'
          : destructive
            ? 'border-border bg-white text-secondary hover:bg-danger-50 hover:text-danger hover:border-danger/30'
            : 'border-border bg-white text-secondary hover:bg-neutral-50 hover:text-foreground',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="shrink-0 text-current opacity-70">{icon}</span>
      <span className="text-xs font-bold uppercase tracking-wider leading-none">{label}</span>
      <KbdBadge label={kbd} />
    </button>
  );
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
  const appliedDiscountsCount =
    cart.filter((item) => item.discount > 0).length + (globalDiscount > 0 ? 1 : 0);

  const handleRemoveActiveItem = () => {
    if (activeItem) {
      removeItem(activeItem.cart_id);
    }
  };

  return (
    <div className="flex flex-col h-full justify-between font-sans bg-white p-4 space-y-3 border-l border-border select-none overflow-hidden">

      {/* ── Top Section: Customer & Metadata ── */}
      <div className="bg-white rounded border border-border p-3 flex flex-col justify-between shrink-0 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">
            {t('pos.cartCustomer')}
          </span>
          <div className="flex gap-1 items-center">
            {selectedCustomer && (
              <button
                type="button"
                onClick={() => selectCustomer(null)}
                title={t('pos.disconnectCustomer')}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold text-danger hover:text-danger/80 hover:bg-danger/10 border border-transparent hover:border-danger/20 transition-colors focus:outline-none"
              >
                <UserMinus size={11} />
                <span>Remove</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openModal('pos_customer_select')}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold text-secondary hover:text-foreground hover:bg-neutral-100 border border-transparent hover:border-border transition-colors focus:outline-none"
            >
              <UserCog size={11} />
              <span>Edit</span>
              <KbdBadge label="F7" />
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

        <div className="flex items-center justify-between text-xs font-mono border-t border-border pt-2 text-secondary">
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
      <div className="bg-white rounded border border-border p-3 shrink-0 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-secondary mb-2">
          Selected Item Actions
        </div>
        <div className="mb-3 text-sm font-bold text-foreground truncate">
          {activeItem ? `› ${activeItem.name} ×${activeItem.quantity}` : 'No item selected'}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <ActionBtn
              label="Quantity"
              kbd="F2"
              icon={<Hash size={13} />}
              onClick={() => activeItem && openModal('pos_quantity')}
              disabled={!activeItem}
            />
            <ActionBtn
              label="Discount"
              kbd="F3"
              icon={<Percent size={13} />}
              onClick={() => activeItem && openModal('pos_discount')}
              disabled={!activeItem}
            />
          </div>
          <ActionBtn
            label="Remove Item"
            kbd="Del"
            icon={<Trash2 size={13} />}
            onClick={handleRemoveActiveItem}
            disabled={!activeItem}
            destructive
            fullWidth
          />
        </div>
      </div>

      {/* ── Cart Actions Grid ── */}
      <div className="bg-white rounded border border-border p-3 shrink-0 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-secondary mb-2">
          Cart Actions
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <ActionBtn
            label="Past Sales"
            kbd="F4"
            icon={<History size={13} />}
            onClick={() => openModal('pos_transaction_search')}
          />
          <ActionBtn
            label="Suspend"
            kbd="F6"
            icon={<PauseCircle size={13} />}
            onClick={() => openModal('pos_suspended_carts')}
          />
          <ActionBtn
            label="Discard Cart"
            kbd="F8"
            icon={<Trash2 size={13} />}
            onClick={() => openModal('pos_manager_override', { action: 'clear_cart' })}
            destructive
          />
          <ActionBtn
            label="Drawer"
            kbd="F9"
            icon={<Banknote size={13} />}
            onClick={() => {
              if (window.electronAPI) {
                window.electronAPI.openCashDrawer().catch(console.error);
              }
            }}
          />
        </div>
      </div>

      {/* ── Bottom Section: Financials & Pay ── */}
      <div className="flex-1 min-h-0 flex flex-col justify-end">
        <div className="bg-white border border-border rounded p-4 space-y-2 select-none mb-3 flex-1 flex flex-col shadow-sm">
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
            <CreditCard size={22} />
            <span>{t('pos.payAction')}</span>
            <KbdBadge label="Space" />
          </button>
        </div>
      </div>
    </div>
  );
});

POSSummary.displayName = 'POSSummary';
