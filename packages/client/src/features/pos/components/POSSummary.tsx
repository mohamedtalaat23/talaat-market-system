import React, { useMemo } from 'react';
import type { POSCartItem } from '../usePOSStore';
import { usePOSStore } from '../usePOSStore';
import { useModalStore } from '@/stores/modalStore';
import { bankersRound } from '@/utils/currency';
import { useTranslation } from '@/hooks/useTranslation';
import { POSCartList } from './POSCartList';
import {
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
    <kbd className="ms-auto text-[10px] font-mono font-semibold px-1 py-0.5 rounded bg-neutral-100 border border-border text-secondary leading-none select-none">
      {label}
    </kbd>
  );
}

/** A single action button in the Cart Actions panel */
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
        'flex items-center gap-2 px-3 h-14 rounded-lg border transition-colors focus:outline-none shadow-sm text-left',
        fullWidth ? 'w-full' : '',
        disabled
          ? 'opacity-40 cursor-not-allowed border-border bg-neutral-50 text-neutral-400'
          : destructive
            ? 'border-border bg-white text-secondary hover:bg-danger-50 hover:text-danger hover:border-danger/30'
            : 'border-border bg-white text-secondary hover:bg-neutral-50 hover:text-foreground hover:border-primary/20',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="shrink-0 text-current opacity-70 flex items-center justify-center w-5 h-5">{icon}</span>
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

  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const appliedDiscountsCount =
    cart.filter((item) => item.discount > 0).length + (globalDiscount > 0 ? 1 : 0);


  return (
    <div className="flex flex-col h-full justify-between font-sans bg-white p-2.5 space-y-2 border-l border-border select-none overflow-hidden">

      {/* ── 1. Customer & Metadata (Top) ── */}
      {/* ── 1. Customer & Metadata (Top) ── */}
      <div className="bg-white rounded border border-border px-2 py-1.5 flex flex-col shrink-0 shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold uppercase tracking-wide text-foreground">
              {selectedCustomer ? selectedCustomer.name : 'Walk-In Customer'}
            </span>
            {selectedCustomer && (
              <span className={`text-[10px] font-bold ${
                selectedCustomer.balance < 0 ? 'text-danger' : selectedCustomer.balance > 0 ? 'text-success' : 'text-secondary'
              }`}>
                Cr: {Number(selectedCustomer.balance).toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex gap-1 items-center">
            {selectedCustomer && (
              <button
                type="button"
                onClick={() => {
                  selectCustomer(null);
                  setTimeout(() => {
                    const searchInput = document.querySelector('input[placeholder*="Scan barcode"]') as HTMLInputElement;
                    searchInput?.focus();
                  }, 50);
                }}
                className="text-danger hover:bg-danger/10 p-1 rounded transition-colors focus:outline-none"
              >
                <UserMinus size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => openModal('pos_customer_select')}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold text-secondary hover:bg-neutral-100 border border-border transition-colors focus:outline-none"
            >
              <UserCog size={12} />
              <span>{selectedCustomer ? 'Change' : 'Assign'}</span>
              <KbdBadge label="F7" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-secondary">
          <div className="flex gap-2">
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

      {/* ── 2. Cart Items list (Middle - Scrollable) ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <POSCartList />
      </div>


      {/* ── 4. Cart Actions Grid ── */}
      <div className="bg-white rounded border border-border p-2 shrink-0 shadow-xs">
        <div className="grid grid-cols-2 gap-1">
          <ActionBtn
            label="Past Sales"
            kbd="F4"
            icon={<History size={18} />}
            onClick={() => openModal('pos_transaction_search')}
          />
          <ActionBtn
            label="Suspend"
            kbd="F6"
            icon={<PauseCircle size={18} />}
            onClick={() => {
              openModal('pos_suspended_carts');
              setTimeout(() => {
                const searchInput = document.querySelector('input[placeholder*="Scan barcode"]') as HTMLInputElement;
                searchInput?.focus();
              }, 50);
            }}
          />
          <ActionBtn
            label="Discard"
            kbd="F8"
            icon={<Trash2 size={18} />}
            onClick={() => {
              openModal('pos_manager_override', { action: 'clear_cart' });
              setTimeout(() => {
                const searchInput = document.querySelector('input[placeholder*="Scan barcode"]') as HTMLInputElement;
                searchInput?.focus();
              }, 50);
            }}
            destructive
          />
          <ActionBtn
            label="Drawer"
            kbd="F9"
            icon={<Banknote size={18} />}
            onClick={() => {
              if (window.electronAPI) {
                window.electronAPI.openCashDrawer().catch(console.error);
              }
              setTimeout(() => {
                const searchInput = document.querySelector('input[placeholder*="Scan barcode"]') as HTMLInputElement;
                searchInput?.focus();
              }, 50);
            }}
          />
        </div>
      </div>

      {/* ── 5. Financials & Pay (Bottom) ── */}
      <div className="shrink-0 flex flex-col justify-end space-y-2">
        <div className="bg-white border border-border rounded p-3 space-y-1.5 select-none flex flex-col shadow-xs">
          <div className="flex justify-between text-xs text-secondary font-mono">
            <span>{t('pos.subtotal')}</span>
            <span>EGP {subtotal.toFixed(2)}</span>
          </div>
          {itemDiscounts > 0 && (
            <div className="flex justify-between text-xs text-success font-mono">
              <span>Item Discounts</span>
              <span>- EGP {itemDiscounts.toFixed(2)}</span>
            </div>
          )}
          {globalDiscount > 0 && (
            <div className="flex justify-between text-xs text-success font-mono">
              <span>{t('pos.globalDiscount')}</span>
              <span>- EGP {globalDiscount.toFixed(2)}</span>
            </div>
          )}

          {/* Grand Total */}
          <div className="border-t-2 border-border pt-4 mt-2">
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-secondary uppercase tracking-widest mb-1">Total</span>
              <span className="text-6xl font-black font-mono text-foreground tracking-tighter select-none leading-none">
                <span className="text-xl text-secondary font-sans font-bold uppercase tracking-wider mr-3">EGP</span>
                {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Pay Button */}
        <div className="shrink-0 select-none pt-1">
          <button
            onClick={() => openModal('pos_payment')}
            className="w-full h-16 bg-success hover:bg-success/90 rounded-lg text-white font-black uppercase text-2xl tracking-widest transition-all focus:outline-none shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-4"
          >
            <CreditCard size={28} />
            <span>{t('pos.payAction')}</span>
            <kbd className="ms-4 text-sm font-mono font-bold px-2 py-1 rounded bg-black/10 border border-black/10 text-white/90 leading-none shadow-inner">
              Space
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
});

POSSummary.displayName = 'POSSummary';
