import { useCallback, useEffect, useMemo, memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, User as UserIcon, AlertTriangle, Save, Trash2 } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { usePOSStore } from '../usePOSStore';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import toast from 'react-hot-toast';

interface SuspendedCartItemProps {
  cart: any;
  onDiscard: (holdId: string, cashierId: number) => void;
  onResume: (holdId: string, cashierId: number) => void;
}

const SuspendedCartItem = memo(({ cart, onDiscard, onResume }: SuspendedCartItemProps) => {
  const { t } = useTranslation();
  const { total } = useMemo(() => {
    const sub = cart.cart.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unit_price - item.discount,
      0,
    );
    return { total: sub - cart.globalDiscount };
  }, [cart]);

  return (
    <div className="bg-[#f8fafc] rounded-2xl border border-border/70 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:shadow-md hover:border-warning/30 border-l-4 border-l-warning/70 hover:border-l-warning group relative overflow-hidden text-left">
      {/* Background glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="z-10 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
          <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-border/50 text-secondary">
            <Clock size={12} className="text-warning animate-pulse" />
            <span>
              {new Date(cart.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </span>
          <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-border/50 text-secondary">
            <UserIcon size={12} className="text-primary" />
            <span>{t('pos.cashierId').replace('{id}', String(cart.cashier_id))}</span>
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-lg font-black text-foreground">
            {cart.cart.length}{' '}
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">
              {cart.cart.length === 1 ? t('pos.item') : t('pos.items')}
            </span>
          </span>
          <span className="text-neutral-200">|</span>
          <span className="text-sm text-secondary font-medium">
            {t('pos.total')}:{' '}
            <span className="text-foreground font-black font-mono text-base">
              {t('pos.currency')} {total.toFixed(2)}
            </span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 z-10 shrink-0 self-end md:self-auto">
        <button
          onClick={() => onDiscard(cart.hold_id, cart.cashier_id)}
          className="px-4 h-10 border border-danger/20 bg-danger/5 hover:bg-danger hover:border-danger text-danger hover:text-white rounded-xl transition-all duration-200 text-xs font-bold uppercase tracking-wider active:scale-95 shadow-sm hover:shadow-md hover:shadow-danger/10"
        >
          {t('pos.discard')}
        </button>
        <button
          onClick={() => onResume(cart.hold_id, cart.cashier_id)}
          className="px-6 h-10 bg-gradient-to-r from-warning to-amber-500 hover:from-warning/90 hover:to-amber-500/90 text-white font-bold rounded-xl shadow-md shadow-warning/20 hover:shadow-lg hover:shadow-warning/30 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 text-xs uppercase tracking-wider flex items-center justify-center gap-1"
        >
          {t('pos.resume')}
        </button>
      </div>
    </div>
  );
});

export function SuspendedCartsModal() {
  const { t } = useTranslation();
  const isOpen = useModalStore((state) => state.activeModals.pos_suspended_carts);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const openModalAction = useModalStore((state) => state.openModal);

  const [overwriteTarget, setOverwriteTarget] = useState<{
    holdId: string;
    cashierId: number;
  } | null>(null);

  const closeModal = useCallback(() => {
    setOverwriteTarget(null);
    closeModalAction('pos_suspended_carts');
  }, [closeModalAction]);

  const heldCarts = usePOSStore((state) => state.heldCarts);
  const resumeCart = usePOSStore((state) => state.resumeCart);
  const removeHeldCart = usePOSStore((state) => state.removeHeldCart);
  const holdCurrentCart = usePOSStore((state) => state.holdCurrentCart);
  const clearCart = usePOSStore((state) => state.clearCart);
  const currentCartLength = usePOSStore((state) => state.cart.length);

  const user = useAuthStore((state) => state.user);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const executeResume = useCallback(
    (holdId: string) => {
      resumeCart(holdId);
      toast.success(t('pos.toasts.cartResumed'));
      closeModal();
    },
    [resumeCart, t, closeModal],
  );

  const handleSuspendCurrentAndResume = useCallback(() => {
    if (!overwriteTarget) return;
    holdCurrentCart(user?.id || 1);
    executeResume(overwriteTarget.holdId);
  }, [overwriteTarget, holdCurrentCart, user?.id, executeResume]);

  const handleDiscardCurrentAndResume = useCallback(() => {
    if (!overwriteTarget) return;
    clearCart();
    executeResume(overwriteTarget.holdId);
  }, [overwriteTarget, clearCart, executeResume]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (overwriteTarget) setOverwriteTarget(null);
        else closeModal();
      }

      // Keyboard-first workflow for overwrite protection
      if (overwriteTarget && isOpen) {
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleSuspendCurrentAndResume();
        } else if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          handleDiscardCurrentAndResume();
        } else if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          setOverwriteTarget(null);
        }
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    overwriteTarget,
    closeModal,
    handleSuspendCurrentAndResume,
    handleDiscardCurrentAndResume,
  ]);

  if (!isOpen) return null;

  const handleResumeClick = (holdId: string, cashierId: number) => {
    if (user?.id !== cashierId && user?.role !== 'admin' && user?.role !== 'manager') {
      closeModal();
      openModalAction('pos_manager_override', {
        action: 'cross_cashier_resume',
        holdId,
      });
      return;
    }

    if (currentCartLength > 0) {
      setOverwriteTarget({ holdId, cashierId });
    } else {
      executeResume(holdId);
    }
  };

  const handleDiscardClick = (holdId: string, cashierId: number) => {
    if (user?.id !== cashierId && user?.role !== 'admin' && user?.role !== 'manager') {
      toast.error(t('pos.toasts.onlyManagersCarts'));
      return;
    }
    if (window.confirm(t('pos.confirmDiscardSuspended'))) {
      removeHeldCart(holdId);
      toast.success(t('pos.toasts.cartDiscarded'));
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="absolute inset-0"
        onClick={() => (overwriteTarget ? setOverwriteTarget(null) : closeModal())}
        aria-hidden="true"
      />

      <div
        ref={focusTrapRef}
        className="w-full max-w-2xl bg-white border border-border/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] animate-fade-in flex flex-col max-h-[80vh] overflow-hidden relative z-10 p-6"
        role="dialog"
      >
        {!overwriteTarget ? (
          <>
            <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4">
              <h3 className="text-xl font-black text-foreground flex items-center gap-2.5">
                <div className="p-2 bg-warning/10 rounded-xl text-warning">
                  <Clock size={20} className="animate-pulse" />
                </div>
                <div className="flex flex-col text-left">
                  <span>{t('pos.suspended')}</span>
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-widest mt-0.5">
                    {t('pos.heldSalesCount').replace('{count}', String(heldCarts.length))}
                  </span>
                </div>
              </h3>
              <button
                onClick={closeModal}
                className="text-secondary hover:text-foreground transition-colors p-2 hover:bg-neutral-100 rounded-xl focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>

            {currentCartLength > 0 && (
              <div className="mb-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-4 border border-primary/20 flex flex-col sm:flex-row gap-3 sm:items-center justify-between animate-fade-in shrink-0 relative overflow-hidden border-l-4 border-l-primary">
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-foreground">
                    {t('pos.activeCartWarning').replace('{count}', String(currentCartLength))}
                  </span>
                  <span className="text-xs text-secondary mt-0.5">
                    {t('pos.suspendToResumeDesc')}
                  </span>
                </div>
                <button
                  onClick={() => {
                    holdCurrentCart(user?.id || 1);
                    toast.success(t('pos.cartSuspended'));
                  }}
                  className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-xs rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-md shadow-primary/20 shrink-0 self-start sm:self-auto"
                >
                  {t('pos.suspendActiveCart')}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {heldCarts.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center text-secondary mb-4 opacity-50">
                    <Clock size={32} />
                  </div>
                  <h4 className="text-base font-bold text-foreground mb-1">
                    {t('pos.noSuspendedCarts')}
                  </h4>
                  <p className="text-xs text-secondary max-w-sm leading-relaxed">
                    {t('pos.noSuspendedCartsDesc')}
                  </p>
                </div>
              ) : (
                heldCarts.map((cart) => (
                  <SuspendedCartItem
                    key={cart.hold_id}
                    cart={cart}
                    onDiscard={handleDiscardClick}
                    onResume={handleResumeClick}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="py-8 px-4 flex flex-col items-center text-center animate-scale-in">
            <div className="w-16 h-16 bg-warning/10 rounded-2xl flex items-center justify-center mb-5 text-warning">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-foreground mb-2">
              {t('pos.activeCartOverwrite')}
            </h3>
            <p className="text-secondary text-sm max-w-md mb-8 leading-relaxed">
              {t('pos.overwriteWarning').replace('{count}', String(currentCartLength))}
            </p>

            <div className="flex flex-col w-full max-w-md space-y-3">
              <button
                onClick={handleSuspendCurrentAndResume}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-xs rounded-xl shadow-md shadow-primary/25 hover:shadow-lg transition-all hover:-translate-y-0.5 active:scale-95 focus:outline-none"
              >
                <Save className="w-4 h-4" />
                <span>{t('pos.suspendCurrentCart')}</span>
              </button>

              <button
                onClick={handleDiscardCurrentAndResume}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/25 font-black uppercase text-xs rounded-xl transition-all hover:-translate-y-0.5 active:scale-95 focus:outline-none"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('pos.discardCurrentCart')}</span>
              </button>

              <button
                onClick={() => setOverwriteTarget(null)}
                className="w-full py-3 text-secondary hover:text-foreground font-black uppercase text-xs transition-colors mt-2"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
