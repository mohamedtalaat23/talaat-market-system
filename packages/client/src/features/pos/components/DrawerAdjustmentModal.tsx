import toast from 'react-hot-toast';
import { apiClient } from '@/services/api-client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalStore } from '@/stores/modalStore';
import { usePOSStore } from '../usePOSStore';
import { X, Vault, ArrowDownRight, ArrowUpRight, FileText } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { InlineManagerApproval } from './InlineManagerApproval';
import { useTranslation } from '@/hooks/useTranslation';

const ADJUSTMENT_TYPES = [
  { value: 'safe_drop', label: 'Safe Drop', type: 'out', icon: Vault, color: 'text-danger' },
  {
    value: 'petty_cash',
    label: 'Petty Cash',
    type: 'out',
    icon: ArrowUpRight,
    color: 'text-danger',
  },
  {
    value: 'vendor_payment',
    label: 'Vendor Payment',
    type: 'out',
    icon: ArrowUpRight,
    color: 'text-danger',
  },
  {
    value: 'owner_withdrawal',
    label: 'Owner Withdrawal',
    type: 'out',
    icon: ArrowUpRight,
    color: 'text-danger',
  },
  {
    value: 'cash_correction_out',
    label: 'Cash Correction (OUT)',
    type: 'out',
    icon: ArrowUpRight,
    color: 'text-danger',
  },
  {
    value: 'change_replenishment',
    label: 'Change Replenishment',
    type: 'in',
    icon: ArrowDownRight,
    color: 'text-success',
  },
  {
    value: 'cash_correction_in',
    label: 'Cash Correction (IN)',
    type: 'in',
    icon: ArrowDownRight,
    color: 'text-success',
  },
];

export function DrawerAdjustmentModal() {
  const { t } = useTranslation();
  const { activeModals, closeModal, modalPayloads } = useModalStore();
  const isOpen = activeModals.pos_drawer_adjustment;
  const payload = modalPayloads.pos_drawer_adjustment;
  const activeShift = usePOSStore((state) => state.activeShift);
  const setActiveShift = usePOSStore((state) => state.setActiveShift);

  const [type, setType] = useState('safe_drop');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const [managerId, setManagerId] = useState<number | ''>('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setType(payload?.type || 'safe_drop');
      setAmount('');
      setNotes('');
    }
  }, [isOpen, payload]);

  if (!isOpen) return null;

  const selectedTypeObj = ADJUSTMENT_TYPES.find((t) => t.value === type);
  const isOut = selectedTypeObj?.type === 'out';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;
    if (!activeShift) return;
    if (!pin || managerId === '') {
      void import('react-hot-toast').then(({ default: toast }) =>
        toast.error(t('pos.toasts.managerPinRequired')),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Inline PIN verification
      const verifyRes = await apiClient.post('/employees/verify-pin', {
        manager_id: managerId,
        pin,
      });

      if (!verifyRes.data?.success) {
        toast.error(t('pos.toasts.invalidManagerPin'));
        setIsSubmitting(false);
        setPin('');
        return;
      }

      const payload = {
        manager_id: managerId,
        manager_pin: pin,
        type: type,
        amount: numericAmount,
        reason_code: type.toUpperCase(),
        reason_notes: notes || null,
      };

      const response = await apiClient.post(`/pos/shifts/${activeShift.id}/adjustments`, payload);
      if (response.data?.success) {
        toast.success(t('pos.toasts.drawerAdjustmentRecorded'));

        // Re-fetch shift to update expected cash
        const shiftRes = await apiClient.get(
          `/pos/shifts/current?register_id=${activeShift.register_id}`,
        );
        if (shiftRes.data?.success) {
          setActiveShift(shiftRes.data.data);
        }

        closeModal('pos_drawer_adjustment');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('pos.failedRecordAdjustment'));
    } finally {
      setIsSubmitting(false);
      setPin('');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-4 text-input-text select-none">
      <div className="absolute inset-0" onClick={() => closeModal('pos_drawer_adjustment')} />
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('pos.drawerAdjustment')}
        className="w-full max-w-lg bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-border/50 rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.7)] relative z-10 animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-border/40">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Vault className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {t('pos.drawerAdjustment')}
            </h2>
          </div>
          <button
            onClick={() => closeModal('pos_drawer_adjustment')}
            className="text-secondary hover:text-foreground p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-8 space-y-6 select-text overflow-y-auto max-h-[80vh]"
        >
          <div className="space-y-2">
            <label className="block text-xs font-bold text-foreground/80 tracking-wider uppercase select-none">
              {t('pos.adjustmentType')}
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-background border border-border/60 rounded-xl h-12 px-4 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-semibold appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: `right 1rem center`,
                backgroundRepeat: `no-repeat`,
                backgroundSize: `1.5em 1.5em`,
                paddingRight: `2.5rem`,
              }}
            >
              <optgroup label={t('pos.moneyOut')} className="font-bold">
                {ADJUSTMENT_TYPES.filter((t_item) => t_item.type === 'out').map((t_item) => (
                  <option key={t_item.value} value={t_item.value} className="font-medium">
                    {t('pos.adjustmentTypes.' + t_item.value)}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t('pos.moneyIn')} className="font-bold">
                {ADJUSTMENT_TYPES.filter((t_item) => t_item.type === 'in').map((t_item) => (
                  <option key={t_item.value} value={t_item.value} className="font-medium">
                    {t('pos.adjustmentTypes.' + t_item.value)}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-foreground/80 tracking-wider uppercase select-none">
              {t('pos.amountEgp')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-secondary font-bold select-none">{t('pos.currency')}</span>
              </div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                className={`w-full bg-background border ${isOut ? 'border-danger/40 focus:border-danger focus:ring-danger/20' : 'border-success/40 focus:border-success focus:ring-success/20'} rounded-xl h-14 pl-14 pr-12 text-foreground text-2xl font-semibold tabular-nums tracking-tight focus:outline-none focus:ring-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all`}
                placeholder="0.00"
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                {selectedTypeObj && (
                  <selectedTypeObj.icon
                    className={`w-6 h-6 ${isOut ? 'text-danger' : 'text-success'}`}
                  />
                )}
              </div>
            </div>
            {isOut && (
              <p className="text-[11px] font-bold text-danger/80 uppercase tracking-wider select-none text-right mt-1">
                {t('pos.decreaseCashWarning')}
              </p>
            )}
            {!isOut && (
              <p className="text-[11px] font-bold text-success/80 uppercase tracking-wider select-none text-right mt-1">
                {t('pos.increaseCashWarning')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-foreground/80 tracking-wider uppercase select-none">
              {t('pos.notesOptional')}
            </label>
            <div className="relative">
              <div className="absolute top-4 left-4 pointer-events-none">
                <FileText className="w-5 h-5 text-secondary/50" />
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-background border border-border/60 rounded-xl py-3 pl-12 pr-4 text-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all resize-none font-medium placeholder:text-neutral-400"
                placeholder={t('pos.addContext')}
              />
            </div>
          </div>

          <div className="pt-2">
            <InlineManagerApproval
              managerId={managerId}
              setManagerId={setManagerId}
              pin={pin}
              setPin={setPin}
              isSubmitting={isSubmitting}
              contextMetadata={
                <div className="flex flex-col">
                  <div className="font-semibold text-xl tracking-tight text-foreground">
                    {selectedTypeObj && t('pos.adjustmentTypes.' + selectedTypeObj.value)}
                  </div>
                  <div
                    className={`font-mono font-bold tracking-wide text-sm mt-1 ${isOut ? 'text-danger' : 'text-success'}`}
                  >
                    {isOut ? t('pos.outLabel') : t('pos.inLabel')}: {t('pos.currency')}{' '}
                    {amount ? parseFloat(amount).toFixed(2) : '0.00'}
                  </div>
                </div>
              }
            />
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={!amount || parseFloat(amount) <= 0 || isSubmitting}
              className={`w-full py-4 rounded-xl font-semibold text-white text-sm tracking-wide uppercase transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                isOut
                  ? 'bg-gradient-to-r from-danger to-red-600 hover:from-danger/90 hover:to-red-500 shadow-[0_4px_14px_rgba(var(--color-danger-500),0.3)] hover:shadow-[0_6px_20px_rgba(var(--color-danger-500),0.4)] hover:-translate-y-0.5 active:scale-95'
                  : 'bg-gradient-to-r from-success to-emerald-500 hover:from-success/90 hover:to-emerald-400 shadow-[0_4px_14px_rgba(var(--color-success-500),0.3)] hover:shadow-[0_6px_20px_rgba(var(--color-success-500),0.4)] hover:-translate-y-0.5 active:scale-95'
              }`}
            >
              {isSubmitting
                ? t('pos.processing')
                : isOut
                  ? t('pos.authorizeWithdraw').replace(
                      '{amount}',
                      amount ? `${t('pos.currency')} ${amount}` : '',
                    )
                  : t('pos.authorizeDeposit').replace(
                      '{amount}',
                      amount ? `${t('pos.currency')} ${amount}` : '',
                    )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default DrawerAdjustmentModal;
