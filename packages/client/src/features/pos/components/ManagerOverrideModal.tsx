import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldAlert } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import toast from 'react-hot-toast';
import { usePOSStore } from '../usePOSStore';
import { useManagers } from '@/features/employees/hooks/useEmployeeQueries';
import { apiClient } from '@/services/api-client';
import { useTranslation } from '@/hooks/useTranslation';

export function ManagerOverrideModal() {
  const { t } = useTranslation();
  const isOpen = useModalStore((state) => state.activeModals.pos_manager_override);
  const payload = useModalStore((state) => state.modalPayloads.pos_manager_override);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const closeModal = () => {
    closeModalAction('pos_manager_override');
    if (payload?.onCancel) {
      payload.onCancel();
    }
  };

  const { data: managers = [] } = useManagers();
  const [selectedManagerId, setSelectedManagerId] = useState<number | ''>('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Set default manager when loaded
  useEffect(() => {
    if (isOpen && managers.length > 0) {
      const firstManager = managers[0];
      if (firstManager) {
        setSelectedManagerId(firstManager.id);
      }
    }
  }, [isOpen, managers]);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) closeModal();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting]);

  if (!isOpen) return null;

  // Map action key → translation key
  const actionKeyMap: Record<string, string> = {
    clear_cart: 'pos.actionClearCart',
    void_transaction: 'pos.actionVoidTransaction',
    refund_transaction: 'pos.actionRefundTransaction',
    drawer_adjustment: 'pos.actionDrawerAdjustment',
    large_discount: 'pos.actionLargeDiscount',
    price_override: 'pos.actionPriceOverride',
    cross_cashier_resume: 'pos.actionCrossCashierResume',
    force_close_shift: 'pos.actionForceCloseShift',
    reprint_receipt: 'pos.actionReprintReceipt',
    enter_pos: 'pos.actionEnterPos',
    exit_pos: 'pos.actionExitPos',
  };

  const actionName = payload?.action
    ? t(actionKeyMap[payload.action] || 'pos.actionRestricted')
    : t('pos.actionRestricted');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || selectedManagerId === '') return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.post('/employees/verify-pin', {
        manager_id: selectedManagerId,
        pin,
      });

      setIsSubmitting(false);
      if (response.data?.success) {
        toast.success(t('pos.overrideApproved'));
        const state = usePOSStore.getState();

        if (payload?.onSuccess) {
          payload.onSuccess(selectedManagerId);
        } else if (payload?.action === 'clear_cart') {
          state.clearCart();
          toast.error('Cart Discarded');
        } else if (payload?.action === 'large_discount') {
          if (payload.target === 'cart') {
            state.setGlobalDiscount(payload.discountValue);
          } else {
            state.updateItemDiscount(payload.cartId, payload.discountValue);
          }
          toast.success(t('pos.largeDiscountApplied'));
        } else if (payload?.action === 'cross_cashier_resume') {
          state.resumeCart(payload.holdId);
          toast.success(t('pos.cartResumed'));
        }

        setPin('');
        closeModalAction('pos_manager_override');
      } else {
        toast.error(t('pos.invalidPin'));
        setPin('');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error(err.response?.data?.message || err.message || t('pos.invalidPin'));
      setPin('');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 transition-all duration-300">
      <div
        className="absolute inset-0"
        onClick={isSubmitting ? undefined : closeModal}
        aria-hidden="true"
      />

      <div
        ref={focusTrapRef}
        className="w-full max-w-sm rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.7)] relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="override-modal-title"
      >
        {/* Subtle red glow at the top for context */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-danger to-transparent opacity-80"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 bg-danger/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col items-center justify-center pb-5 mb-5 border-b border-border/40 relative z-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 text-danger mb-4 shadow-inner border border-danger/20">
            <ShieldAlert size={36} className="drop-shadow-sm" />
          </div>
          <h3 id="override-modal-title" className="text-2xl font-black text-foreground text-center tracking-tight">
            {t('pos.managerAuthTitle')}
          </h3>
          <p className="text-secondary text-sm mt-1.5 text-center font-medium">{actionName}</p>

          {payload?.displayMetadata && (
            <div className="mt-5 w-full bg-background/50 border border-border/60 rounded-xl p-4 text-sm shadow-inner">
              <div className="font-bold text-foreground mb-3 text-center border-b border-border/40 pb-2">
                {payload.displayMetadata.title}
              </div>
              <div className="space-y-2">
                {payload.displayMetadata.customer && (
                  <div className="flex justify-between items-center">
                    <span className="text-secondary font-medium">Customer:</span>
                    <span className="text-foreground font-semibold">{payload.displayMetadata.customer}</span>
                  </div>
                )}
                {payload.displayMetadata.amount !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-secondary font-medium">Amount:</span>
                    <span className="font-mono text-foreground font-black text-base">EGP {Number(payload.displayMetadata.amount).toFixed(2)}</span>
                  </div>
                )}
                {payload.displayMetadata.actionType && (
                  <div className="flex justify-between items-center">
                    <span className="text-secondary font-medium">Type:</span>
                    <span className="text-foreground font-semibold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">{payload.displayMetadata.actionType}</span>
                  </div>
                )}
                {payload.displayMetadata.direction && (
                  <div className="flex justify-between items-center">
                    <span className="text-secondary font-medium">Direction:</span>
                    <span className={`font-black tracking-wider ${payload.displayMetadata.direction === 'OUT' ? 'text-danger' : 'text-success'}`}>{payload.displayMetadata.direction}</span>
                  </div>
                )}
                {payload.displayMetadata.inventoryEffect && (
                  <div className="flex justify-between items-center">
                    <span className="text-secondary font-medium">Inventory:</span>
                    <span className={`font-black tracking-wider ${payload.displayMetadata.inventoryEffect === 'RESTOCK' ? 'text-success' : 'text-warning'}`}>{payload.displayMetadata.inventoryEffect}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={closeModal}
          className="absolute top-4 end-4 rounded-full p-2 text-secondary hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger z-20"
          aria-label={t('common.cancel')}
        >
          <X size={20} />
        </button>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          {managers.length > 0 && (
            <div className="space-y-1.5">
              <label
                htmlFor="manager-select"
                className="block text-sm font-bold text-foreground/80"
              >
                {t('pos.authorizeAs')}
              </label>
              <select
                id="manager-select"
                disabled={isSubmitting}
                className="w-full h-12 bg-background border border-border/60 rounded-xl px-4 text-foreground focus:outline-none focus:border-danger/50 focus:ring-2 focus:ring-danger/20 text-sm font-semibold transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(Number(e.target.value))}
              >
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="pin-input" className="block text-sm font-bold text-foreground/80">
              {t('pos.enterPin')}
            </label>
            <input
              id="pin-input"
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={6}
              disabled={isSubmitting}
              className="w-full h-14 bg-background border border-border/60 rounded-xl px-4 text-center text-foreground font-mono text-2xl tracking-[0.75em] placeholder:text-neutral-300 focus:outline-none focus:border-danger/50 focus:ring-2 focus:ring-danger/20 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || pin.length < 4}
            className="w-full h-12 mt-2 bg-gradient-to-r from-danger to-red-600 hover:from-danger/90 hover:to-red-500 disabled:from-neutral-300 disabled:to-neutral-300 dark:disabled:from-neutral-700 dark:disabled:to-neutral-700 disabled:text-neutral-500 rounded-xl font-black uppercase tracking-wider text-white transition-all shadow-[0_4px_14px_rgba(239,68,68,0.3)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.5)] disabled:shadow-none hover:-translate-y-0.5 active:scale-95 flex items-center justify-center"
          >
            {isSubmitting ? (
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                <span>{t('pos.verifying')}</span>
              </div>
            ) : (
              t('pos.authorizeAction')
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
