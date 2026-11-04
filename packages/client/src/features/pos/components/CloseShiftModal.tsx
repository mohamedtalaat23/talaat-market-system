import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalStore } from '@/stores/modalStore';
import { usePOSStore } from '../usePOSStore';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { Lock, X, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useLANStore } from '../stores/useLANStore';
import { useTranslation } from '@/hooks/useTranslation';

export function CloseShiftModal() {
  const { t } = useTranslation();
  const { activeModals, closeModal, openModal, modalPayloads } = useModalStore();
  const isOpen = activeModals.pos_close_shift;
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen && !activeModals.pos_manager_override);
  const activeShift = usePOSStore((state) => state.activeShift);
  const setActiveShift = usePOSStore((state) => state.setActiveShift);
  const heldCarts = usePOSStore((state) => state.heldCarts);
  const user = useAuthStore((state) => state.user);

  const [endingCash, setEndingCash] = useState<string>('');
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsOverride, setNeedsOverride] = useState(false);

  // Check for successful manager override
  useEffect(() => {
    if (isOpen && needsOverride && modalPayloads.pos_close_shift?.override_granted) {
      setNeedsOverride(false); // Override granted
    }
  }, [isOpen, needsOverride, modalPayloads.pos_close_shift]);

  const fetchSummary = useCallback(async () => {
    if (!activeShift) return;
    setIsLoading(true);
    try {
      const { status } = useLANStore.getState();

      // Resilient offline calculations using active shift running tallies
      if (status === 'offline') {
        const localSummary = {
          shift_id: activeShift.id,
          starting_cash: Number(activeShift.starting_cash || 0),
          cash_sales: Number(activeShift.cash_sales || 0),
          card_sales: Number(activeShift.card_sales || 0),
          total_discounts: Number(activeShift.total_discounts || 0),
          expected_cash:
            Number(activeShift.starting_cash || 0) + Number(activeShift.cash_sales || 0),
          pending_prints: 0,
        };
        setSummary(localSummary);

        const myHeldCarts = heldCarts.filter((c) => c.cashier_id === user?.id);
        if (myHeldCarts.length > 0) {
          setNeedsOverride(true);
        }
        setIsLoading(false);
        return;
      }

      const response = await apiClient.get<{ success: boolean; data: any }>(
        `/pos/shifts/${activeShift.id}/summary`,
      );
      if (response.data?.success) {
        const data = response.data.data;
        setSummary(data);

        // Safety Validation
        const myHeldCarts = heldCarts.filter((c) => c.cashier_id === user?.id);
        if (data.pending_prints > 0 || myHeldCarts.length > 0) {
          setNeedsOverride(true);
        }
      }
    } catch {
      toast.error(t('pos.toasts.failedFetchSummary'));
    } finally {
      setIsLoading(false);
    }
  }, [activeShift, heldCarts, user?.id, t]);

  useEffect(() => {
    if (isOpen && activeShift) {
      void fetchSummary();
      setEndingCash('');
      setNeedsOverride(false);
    }
  }, [isOpen, activeShift, fetchSummary]);

  if (!isOpen) return null;

  const handleCloseShift = async () => {
    if (!activeShift) return;
    if (needsOverride) {
      openModal('pos_manager_override', {
        action: 'force_close_shift',
        onSuccess: () => {
          // Setting this payload allows the useEffect to clear needsOverride
          openModal('pos_close_shift', { override_granted: true });
        },
      });
      return;
    }

    const cash = parseFloat(endingCash);
    if (isNaN(cash) || cash < 0) {
      toast.error(t('pos.toasts.enterActualCash'));
      return;
    }

    setIsSubmitting(true);
    const { status, mode, setStatus, addOfflineShiftClosure } = useLANStore.getState();

    // Resilient offline close shift buffering
    if (status === 'offline') {
      addOfflineShiftClosure({
        id: crypto.randomUUID(),
        payload: {
          shift_id: activeShift.id,
          ending_cash: cash,
          expected_cash: summary?.expected_cash || 0,
          notes: 'Offline cashier shift closure',
        },
        timestamp: new Date().toISOString(),
      });

      toast.success(t('pos.toasts.shiftClosedOffline'), {
        icon: '💾',
        duration: 4000,
      });
      setActiveShift(null);
      closeModal('pos_close_shift');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await apiClient.post<{ success: boolean; data: any }>('/pos/shifts/close', {
        shift_id: activeShift.id,
        ending_cash: cash,
        expected_cash: summary?.expected_cash || 0,
        notes: '',
      });

      if (response.data?.success) {
        toast.success(t('pos.toasts.shiftClosed'));
        setActiveShift(null);
        closeModal('pos_close_shift');
      }
    } catch (error: any) {
      const isNetworkError =
        !error.response ||
        error.message?.includes('Network Error') ||
        error.status === undefined ||
        error.status >= 500;

      if (mode === 'client' && isNetworkError) {
        toast.error(t('pos.toasts.shiftClosedOfflineFallback'), { duration: 4000 });
        setStatus('offline');
        addOfflineShiftClosure({
          id: crypto.randomUUID(),
          payload: {
            shift_id: activeShift.id,
            ending_cash: cash,
            expected_cash: summary?.expected_cash || 0,
            notes: 'Offline shift closure fallback',
          },
          timestamp: new Date().toISOString(),
        });
        setActiveShift(null);
        closeModal('pos_close_shift');
      } else {
        toast.error(error.message || t('pos.toasts.failedCloseShift'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const myHeldCarts = heldCarts.filter((c) => c.cashier_id === user?.id);
  const discrepancy = summary ? parseFloat(endingCash || '0') - summary.expected_cash : 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px] text-foreground select-none p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('pos.closeShiftReport')}
        className="max-h-[90vh] overflow-y-auto bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-border/50 rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.7)] w-full max-w-lg flex flex-col relative z-10 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/40">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-danger/10 rounded-xl">
              <Lock className="w-6 h-6 text-danger" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {t('pos.closeShiftReport')}
            </h2>
          </div>
          <button
            onClick={() => closeModal('pos_close_shift')}
            className="text-secondary hover:text-foreground p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8 select-text">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-success"></div>
            </div>
          ) : summary ? (
            <>
              {needsOverride && (
                <div className="bg-warning/10 border border-warning/30 rounded-xl p-5 flex items-start space-x-4 text-warning shadow-sm">
                  <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5 text-warning" />
                  <div className="text-sm space-y-1.5">
                    <p className="font-semibold uppercase tracking-wide text-warning text-[11px]">
                      {t('pos.operationalWarnings')}
                    </p>
                    <div className="font-medium space-y-1">
                      {summary.pending_prints > 0 && (
                        <p>
                          •{' '}
                          {t('pos.pendingPrintsWarning').replace(
                            '{count}',
                            String(summary.pending_prints),
                          )}
                        </p>
                      )}
                      {myHeldCarts.length > 0 && (
                        <p>
                          •{' '}
                          {t('pos.suspendedCartsWarning').replace(
                            '{count}',
                            String(myHeldCarts.length),
                          )}
                        </p>
                      )}
                    </div>
                    <p className="pt-2 text-warning/80 font-bold text-[11px] uppercase tracking-wider">
                      {t('pos.managerOverrideRequiredClose')}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background border border-border/60 rounded-xl p-5 space-y-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                    {t('pos.startingCash')}
                  </p>
                  <p className="text-2xl font-semibold font-mono tracking-tight text-foreground">
                    {t('pos.currency')} {summary.starting_cash.toFixed(2)}
                  </p>
                </div>
                <div className="bg-background border border-border/60 rounded-xl p-5 space-y-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                    {t('pos.cashSales')}
                  </p>
                  <p className="text-2xl font-semibold text-success font-mono tracking-tight">
                    +{t('pos.currency')} {summary.cash_sales.toFixed(2)}
                  </p>
                </div>
                <div className="bg-background border border-border/60 rounded-xl p-5 space-y-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                    {t('pos.cardSales')}
                  </p>
                  <p className="text-2xl font-semibold text-primary font-mono tracking-tight">
                    {t('pos.currency')} {summary.card_sales.toFixed(2)}
                  </p>
                </div>
                <div className="bg-background border border-border/60 rounded-xl p-5 space-y-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] ring-1 ring-foreground/5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                    {t('pos.expectedCash')}
                  </p>
                  <p className="text-2xl font-semibold text-foreground font-mono tracking-tight">
                    {t('pos.currency')} {summary.expected_cash.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-6 border-t border-border/40">
                <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-secondary">
                  <span>{t('pos.actualCashCounted')}</span>
                  {endingCash && (
                    <span
                      className={`font-mono font-semibold text-sm tracking-wide ${discrepancy < 0 ? 'text-danger' : discrepancy > 0 ? 'text-success' : 'text-secondary'}`}
                    >
                      {t('pos.diff')} {discrepancy > 0 ? '+' : ''}
                      {discrepancy.toFixed(2)}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary font-bold select-none">
                    {t('pos.currency')}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    autoFocus
                    value={endingCash}
                    onChange={(e) => setEndingCash(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void handleCloseShift();
                      }
                      if (e.key === 'Escape') closeModal('pos_close_shift');
                    }}
                    className="w-full bg-background border border-border/60 rounded-xl h-16 pl-14 pr-6 text-3xl font-semibold tabular-nums tracking-tight text-foreground focus:outline-none focus:border-danger/50 focus:ring-2 focus:ring-danger/20 transition-all placeholder:text-neutral-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-secondary text-center">{t('pos.noSummaryData')}</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/40 flex flex-col sm:flex-row justify-end gap-3 select-none bg-neutral-50/50 dark:bg-neutral-900/50">
          <button
            onClick={() => closeModal('pos_close_shift')}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-secondary hover:text-foreground bg-white dark:bg-card border border-border/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all text-sm uppercase tracking-wider shadow-sm focus:outline-none"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCloseShift}
            disabled={isSubmitting || isLoading || (!endingCash && !needsOverride)}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-white text-sm uppercase tracking-wider transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
              needsOverride
                ? 'bg-gradient-to-r from-warning to-yellow-500 hover:from-warning/90 hover:to-yellow-400 shadow-[0_4px_14px_rgba(var(--color-warning-500),0.3)] hover:shadow-[0_6px_20px_rgba(var(--color-warning-500),0.4)] hover:-translate-y-0.5 active:scale-95'
                : 'bg-gradient-to-r from-danger to-red-600 hover:from-danger/90 hover:to-red-500 shadow-[0_4px_14px_rgba(var(--color-danger-500),0.3)] hover:shadow-[0_6px_20px_rgba(var(--color-danger-500),0.4)] hover:-translate-y-0.5 active:scale-95'
            }`}
          >
            {isSubmitting
              ? t('pos.processing')
              : needsOverride
                ? t('pos.managerOverrideRequired')
                : t('pos.closeShift')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
