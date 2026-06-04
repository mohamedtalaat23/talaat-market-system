import { useEffect, useState } from 'react';
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
    void_transaction: 'pos.actionVoidTransaction',
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
          payload.onSuccess();
        } else if (payload?.action === 'void_transaction') {
          state.clearCart();
          toast.error(t('pos.transactionVoided'));
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

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="absolute inset-0"
        onClick={isSubmitting ? undefined : closeModal}
        aria-hidden="true"
      />

      <div
        ref={focusTrapRef}
        className="w-full max-w-sm rounded-lg border border-danger/30 bg-popover p-6 shadow-2xl relative z-10 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="override-modal-title"
      >
        <div className="flex flex-col items-center justify-center pb-4 mb-4 border-b border-border">
          <ShieldAlert size={48} className="text-danger mb-2" />
          <h3 id="override-modal-title" className="text-xl font-bold text-foreground text-center">
            {t('pos.managerAuthTitle')}
          </h3>
          <p className="text-secondary text-sm mt-1 text-center">{actionName}</p>
        </div>
        <button
          onClick={closeModal}
          className="absolute top-4 end-4 rounded-md p-1.5 text-secondary hover:text-foreground hover:bg-card-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          aria-label={t('common.cancel')}
        >
          <X size={18} />
        </button>

        <form onSubmit={handleSubmit} className="space-y-4">
          {managers.length > 0 && (
            <div>
              <label
                htmlFor="manager-select"
                className="block text-sm font-semibold text-secondary mb-1"
              >
                {t('pos.authorizeAs')}
              </label>
              <select
                id="manager-select"
                disabled={isSubmitting}
                className="w-full bg-input border border-border rounded p-3 text-foreground focus:outline-none focus:border-danger text-sm font-semibold"
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

          <div>
            <label htmlFor="pin-input" className="block text-sm font-semibold text-secondary mb-1">
              {t('pos.enterPin')}
            </label>
            <input
              id="pin-input"
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={6}
              disabled={isSubmitting}
              className="w-full bg-input border border-border rounded p-3 text-center text-3xl tracking-[1em] text-foreground placeholder-secondary/50 focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || pin.length < 4}
            className="w-full py-3 bg-danger hover:bg-danger/90 disabled:bg-card-hover disabled:text-secondary rounded font-bold text-white transition-colors"
          >
            {isSubmitting ? t('pos.verifying') : t('pos.authorizeAction')}
          </button>
        </form>
      </div>
    </div>
  );
}
