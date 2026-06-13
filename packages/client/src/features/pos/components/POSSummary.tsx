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
        'flex items-center gap-2 px-3 h-14 rounded-xl border transition-all duration-200 focus:outline-none shadow-sm text-left relative overflow-hidden group',
        fullWidth ? 'w-full' : '',
        disabled
          ? 'opacity-50 cursor-not-allowed border-border/50 bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
          : destructive
            ? 'border-danger/30 bg-danger/5 text-danger hover:bg-danger hover:text-white hover:border-danger hover:shadow-[0_4px_12px_rgba(239,68,68,0.3)] active:scale-95'
            : 'border-border/60 bg-white dark:bg-card text-secondary hover:bg-gradient-to-br hover:from-white hover:to-neutral-50 dark:hover:from-card dark:hover:to-background hover:text-foreground hover:border-primary/40 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] active:scale-95',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Optional hover glow effect */}
      {!disabled && !destructive && (
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
      <span className="shrink-0 text-current opacity-70 flex items-center justify-center w-5 h-5 group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-xs font-bold uppercase tracking-wider leading-none z-10">{label}</span>
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
    <div className="flex flex-col h-full justify-between font-sans bg-white p-4 space-y-3 border-l border-border/30 select-none overflow-hidden relative z-20">

      {/* ── 1. Customer & Metadata (Top) ── */}
      <div className="bg-[#f8fafc] rounded-xl border border-border/40 px-3 py-2.5 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <UserCog size={14} />
            </div>
            <span className="text-sm font-black text-foreground tracking-tight">
              {selectedCustomer ? selectedCustomer.name : 'Walk-In Customer'}
            </span>
            {selectedCustomer && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                selectedCustomer.balance < 0 ? 'bg-danger/10 text-danger' : selectedCustomer.balance > 0 ? 'bg-success/10 text-success' : 'bg-secondary/10 text-secondary'
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
                className="text-danger hover:bg-danger/10 p-1.5 rounded-lg transition-colors focus:outline-none"
              >
                <UserMinus size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => openModal('pos_customer_select')}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold text-secondary hover:bg-white hover:text-primary border border-border/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            >
              <span>{selectedCustomer ? 'Change' : 'Assign'}</span>
              <KbdBadge label="F7" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono font-medium text-secondary">
          <div className="flex gap-2">
            <span className="bg-white border border-border/40 px-2 py-0.5 rounded-md">Items: {totalItemsCount}</span>
            <span className="bg-white border border-border/40 px-2 py-0.5 rounded-md">Disc: {appliedDiscountsCount}</span>
          </div>
          <button
            onClick={() => openModal('pos_suspended_carts')}
            className="font-bold hover:text-primary transition-colors focus:outline-none text-secondary/70"
          >
            Suspended ({heldCarts.length})
          </button>
        </div>
      </div>

      {/* ── 2. Cart Items list (Middle - Scrollable) ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#f8fafc] rounded-xl border border-border/30">
        <POSCartList />
      </div>


      {/* ── 4. Cart Actions Grid ── */}
      <div className="bg-[#f8fafc] rounded-xl border border-border/40 p-2 shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <ActionBtn
            label="Past Sales"
            kbd="F4"
            icon={<History size={16} />}
            onClick={() => openModal('pos_transaction_search')}
          />
          <ActionBtn
            label="Suspend"
            kbd="F6"
            icon={<PauseCircle size={16} />}
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
            icon={<Trash2 size={16} />}
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
            icon={<Banknote size={16} />}
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
      <div className="shrink-0 flex flex-col justify-end space-y-3">
        <div className="bg-[#f8fafc] border border-border/40 rounded-2xl p-4 space-y-2 select-none flex flex-col relative overflow-hidden shadow-sm">
          <div className="flex justify-between text-sm text-secondary font-mono font-medium">
            <span>{t('pos.subtotal')}</span>
            <span>EGP {subtotal.toFixed(2)}</span>
          </div>
          {itemDiscounts > 0 && (
            <div className="flex justify-between text-sm text-success font-mono font-bold">
              <span>Item Discounts</span>
              <span>- EGP {itemDiscounts.toFixed(2)}</span>
            </div>
          )}
          {globalDiscount > 0 && (
            <div className="flex justify-between text-sm text-success font-mono font-bold">
              <span>{t('pos.globalDiscount')}</span>
              <span>- EGP {globalDiscount.toFixed(2)}</span>
            </div>
          )}

          {/* Grand Total */}
          <div className="border-t border-border/60 pt-3 mt-1">
            <div className="flex items-end justify-between">
              <span className="text-xs font-black text-secondary uppercase tracking-widest">Total</span>
              <span className="text-5xl font-black font-mono tracking-tighter select-none leading-none text-foreground">
                <span className="text-lg text-secondary font-sans font-bold uppercase tracking-wider mr-1 align-top pt-1 inline-block">EGP</span>
                {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Pay Button */}
        <div className="shrink-0 select-none pt-2">
          <button
            onClick={() => openModal('pos_payment')}
            className="w-full h-20 bg-gradient-to-r from-success via-emerald-500 to-success hover:from-success/90 hover:via-emerald-400 hover:to-success/90 rounded-2xl text-white font-black uppercase text-3xl tracking-widest transition-all duration-300 focus:outline-none shadow-[0_8px_30px_rgba(34,197,94,0.3)] hover:shadow-[0_8px_40px_rgba(34,197,94,0.5)] hover:-translate-y-1 flex items-center justify-center gap-4 overflow-hidden relative group"
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out" />
            
            <CreditCard size={32} className="drop-shadow-md group-hover:scale-110 transition-transform duration-300" />
            <span className="drop-shadow-md">{t('pos.payAction')}</span>
            <kbd className="ms-4 text-base font-mono font-bold px-3 py-1.5 rounded-lg bg-black/20 border border-black/10 text-white leading-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] backdrop-blur-sm">
              Space
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
});

POSSummary.displayName = 'POSSummary';
