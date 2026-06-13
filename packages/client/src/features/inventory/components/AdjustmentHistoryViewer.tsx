import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clipboard, History, ArrowRight, User } from 'lucide-react';
import { useInventoryAdjustments } from '../hooks/useInventoryQueries';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * AdjustmentHistoryViewer side panel.
 * Hooked directly to useModalStore for decoupled invocation.
 * Uses WAI-ARIA and focus trapping for accessibility.
 */
export function AdjustmentHistoryViewer() {
  const { t } = useTranslation();
  const isOpen = useModalStore((state) => state.activeModals.inventory_history);
  const payload = useModalStore((state) => state.modalPayloads.inventory_history);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const closeModal = () => closeModalAction('inventory_history');

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const productId = payload?.productId;
  const productName = payload?.productName;

  // Memoize filters to prevent infinite query refetching trigger
  const queryFilters = useMemo(
    () => ({
      page,
      limit,
      product_id: productId,
    }),
    [page, limit, productId],
  );

  // Fetch paginated active adjustments history
  const {
    data: adjustmentsData,
    isLoading,
    error,
    refetch,
  } = useInventoryAdjustments(queryFilters);

  const adjustments = adjustmentsData?.data || [];
  const meta = adjustmentsData?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };

  // Close panel on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Reset page when product ID changes or modal opens
  useEffect(() => {
    setPage(1);
    if (isOpen) {
      refetch();
    }
  }, [productId, isOpen]);

  if (!isOpen) return null;

  // Format type styles
  const getTypeBadgeDetails = (type: string) => {
    switch (type) {
      case 'stock_addition':
        return { label: t('inventory.stockAddition'), variant: 'success' as const, borderColor: 'border-l-success' };
      case 'stock_removal':
        return { label: t('inventory.stockRemoval'), variant: 'destructive' as const, borderColor: 'border-l-destructive' };
      case 'damaged':
        return { label: t('inventory.damagedStock'), variant: 'destructive' as const, borderColor: 'border-l-destructive' };
      case 'expired':
        return { label: t('inventory.expiredStock'), variant: 'destructive' as const, borderColor: 'border-l-destructive' };
      case 'manual_correction':
        return { label: t('inventory.manualCorrection'), variant: 'warning' as const, borderColor: 'border-l-warning' };
      default:
        return { label: type, variant: 'outline' as const, borderColor: 'border-l-border' };
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[250] flex justify-end bg-black/60 backdrop-blur-[1px] select-text">
      {/* Backdrop closer click hook */}
      <div className="absolute inset-0" onClick={closeModal} aria-hidden="true" />

      {/* Side Slide Panel */}
      <div
        ref={focusTrapRef}
        className="w-full max-w-2xl bg-input border-l border-border h-full flex flex-col shadow-2xl relative z-10 animate-slide-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-panel-title"
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent select-none shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <History className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <h3 id="history-panel-title" className="font-bold text-lg text-primary tracking-tight">
              {productName
                ? `${t('inventory.auditHistory').replace('{name}', productName)}`
                : t('inventory.globalLogs')}
            </h3>
          </div>
          <button
            onClick={closeModal}
            className="rounded-md p-1.5 text-secondary hover:text-foreground hover:bg-card-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={t('products.closeModal')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Panel Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex h-60 w-full flex-col items-center justify-center">
              <Spinner size="md" />
              <span className="mt-3 text-xs text-muted-foreground font-medium">
                {t('inventory.loadingHistory')}
              </span>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">
              {t('inventory.failedLoadHistory')}: {error.message}
            </div>
          ) : adjustments.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-12 border border-border rounded-lg bg-card-hover/30">
              <Clipboard className="h-8 w-8 text-neutral-600 mb-3" aria-hidden="true" />
              <div className="text-sm font-semibold text-secondary">{t('inventory.noRecords')}</div>
              <div className="text-xs text-neutral-500 mt-1">{t('inventory.noRecordsDesc')}</div>
            </div>
          ) : (
            <div className="space-y-4">
              {adjustments.map((log) => {
                const badge = getTypeBadgeDetails(log.adjustment_type);
                const signedChange =
                  log.quantity_change > 0 ? `+${log.quantity_change}` : log.quantity_change;
                return (
                  <div
                    key={log.id}
                    className={`rounded-xl border border-border/50 bg-card p-5 space-y-4 hover:shadow-lg transition-all text-xs border-l-[6px] ${badge.borderColor}`}
                  >
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        <span className="font-bold text-foreground">
                          {signedChange} {log.product_unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
                        <Calendar size={12} aria-hidden="true" />
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {!productName && (
                      <div className="font-semibold text-foreground text-sm">
                        {log.product_name}{' '}
                        <span className="text-muted-foreground text-xs font-normal">
                          ({log.product_barcode || 'Loose'})
                        </span>
                      </div>
                    )}

                    {/* Stock Shift Indicator */}
                    <div className="flex items-center gap-4 bg-muted/30 px-4 py-3 rounded-md border border-border/50 text-center justify-around">
                      <div className="flex flex-col items-center">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t('inventory.previous')}</div>
                        <div className="font-bold text-secondary text-base">{log.old_quantity}</div>
                      </div>
                      <ArrowRight size={14} className="text-muted-foreground" aria-hidden="true" />
                      <div className="flex flex-col items-center">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t('inventory.newStock')}</div>
                        <div className="font-bold text-foreground text-base">{log.new_quantity}</div>
                      </div>
                    </div>

                    {/* Audit Trail Note & Cashier Name */}
                    <div className="space-y-1.5 bg-muted/20 p-3 rounded-md border border-border/40">
                      <div className="text-secondary font-medium select-text text-[11px]">
                        <span className="font-bold opacity-75">{t('inventory.reason')}:</span> {log.notes || t('inventory.noReason')}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] pt-1">
                        <User size={12} aria-hidden="true" />
                        <span>
                          {t('inventory.processedBy')}:{' '}
                          <strong className="text-secondary font-bold">
                            {log.creator_name || t('inventory.systemOperator')}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel Footer Pagination */}
        {meta.totalPages > 1 && (
          <div className="border-t border-border bg-card-hover/50 p-4 flex items-center justify-between shrink-0 select-none">
            <div className="text-xs text-neutral-500">
              {t('inventory.totalLogged').replace('{count}', String(meta.total))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={meta.page === 1 || isLoading}
              >
                {t('inventory.prev')}
              </Button>
              <span className="text-xs font-medium text-secondary" aria-current="page">
                {t('inventory.pageOf')
                  .replace('{page}', String(meta.page))
                  .replace('{total}', String(meta.totalPages))}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
                disabled={meta.page === meta.totalPages || isLoading}
              >
                {t('inventory.next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
export default AdjustmentHistoryViewer;
