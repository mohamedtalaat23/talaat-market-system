import { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Clipboard, History, ArrowRight, User } from 'lucide-react';
import { useInventoryAdjustments } from '../hooks/useInventoryQueries';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/**
 * AdjustmentHistoryViewer side panel.
 * Hooked directly to useModalStore for decoupled invocation.
 * Uses WAI-ARIA and focus trapping for accessibility.
 */
export function AdjustmentHistoryViewer() {
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
  const queryFilters = useMemo(() => ({
    page,
    limit,
    product_id: productId,
  }), [page, limit, productId]);

  // Fetch paginated active adjustments history
  const { data: adjustmentsData, isLoading, error, refetch } = useInventoryAdjustments(queryFilters);

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
        return { label: 'Stock Addition', variant: 'success' as const };
      case 'stock_removal':
        return { label: 'Stock Removal', variant: 'destructive' as const };
      case 'damaged':
        return { label: 'Damaged Stock', variant: 'destructive' as const };
      case 'expired':
        return { label: 'Expired Stock', variant: 'destructive' as const };
      case 'manual_correction':
        return { label: 'Correction', variant: 'warning' as const };
      default:
        return { label: type, variant: 'outline' as const };
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex justify-end bg-black/60 backdrop-blur-[1px] select-text">
      {/* Backdrop closer click hook */}
      <div 
        className="absolute inset-0" 
        onClick={closeModal} 
        aria-hidden="true"
      />

      {/* Side Slide Panel */}
      <div
        ref={focusTrapRef}
        className="w-full max-w-2xl bg-input border-l border-border h-full flex flex-col shadow-2xl relative z-10 animate-slide-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-panel-title"
      >
        {/* Panel Header */}
        <div className="flex h-[60px] items-center justify-between px-6 border-b border-border select-none">
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 id="history-panel-title" className="font-bold text-foreground">
              {productName ? `Audit History: ${productName}` : 'Global Adjustment Logs'}
            </h3>
          </div>
          <button
            onClick={closeModal}
            className="rounded-md p-1.5 text-secondary hover:text-foreground hover:bg-card-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Panel Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex h-60 w-full flex-col items-center justify-center">
              <Spinner size="md" />
              <span className="mt-3 text-xs text-neutral-500 font-mono">Loading history ledger...</span>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">
              Failed to load adjustments: {error.message}
            </div>
          ) : adjustments.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-12 border border-border rounded-lg bg-neutral-900/10">
              <Clipboard className="h-8 w-8 text-neutral-600 mb-3" aria-hidden="true" />
              <div className="text-sm font-semibold text-secondary">No Adjustment Records Found</div>
              <div className="text-xs text-neutral-500 mt-1">This product has no manual or relative adjustment logs.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {adjustments.map((log) => {
                const badge = getTypeBadgeDetails(log.adjustment_type);
                const signedChange = log.quantity_change > 0 ? `+${log.quantity_change}` : log.quantity_change;
                return (
                  <div
                    key={log.id}
                    className="rounded-lg border border-border bg-neutral-900/30 p-4 space-y-3 hover:border-border/80 transition-all text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        <span className="font-mono font-bold text-foreground">
                          {signedChange} {log.product_unit}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 text-neutral-500 font-mono">
                        <Calendar size={12} aria-hidden="true" />
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {!productName && (
                      <div className="font-semibold text-neutral-200">
                        {log.product_name} <span className="font-mono text-neutral-500">({log.product_barcode || 'Loose'})</span>
                      </div>
                    )}

                    {/* Stock Shift Indicator */}
                    <div className="flex items-center space-x-3 bg-input p-2 rounded border border-border font-mono text-center justify-around">
                      <div>
                        <div className="text-[9px] text-neutral-500">PREVIOUS</div>
                        <div className="font-semibold text-secondary">{log.old_quantity}</div>
                      </div>
                      <ArrowRight size={12} className="text-neutral-600" aria-hidden="true" />
                      <div>
                        <div className="text-[9px] text-neutral-500">NEW STOCK</div>
                        <div className="font-semibold text-foreground">{log.new_quantity}</div>
                      </div>
                    </div>

                    {/* Audit Trail Note & Cashier Name */}
                    <div className="space-y-1 bg-neutral-900/60 p-2.5 rounded border border-border/40">
                      <div className="text-secondary font-medium select-text">
                        Reason: {log.notes || 'No reason details entered'}
                      </div>
                      <div className="flex items-center space-x-1.5 text-neutral-500 text-[10px] pt-1">
                        <User size={10} aria-hidden="true" />
                        <span>Processed by: <strong className="text-secondary font-semibold">{log.creator_name || 'System Operator'}</strong></span>
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
          <div className="border-t border-border bg-neutral-900/40 p-4 flex items-center justify-between shrink-0 select-none">
            <div className="text-[10px] text-neutral-500">
              Upto {meta.total} total adjustments logged
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={meta.page === 1 || isLoading}
              >
                Prev
              </Button>
              <span className="text-[11px] font-mono text-secondary" aria-current="page">
                Page {meta.page} / {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
                disabled={meta.page === meta.totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default AdjustmentHistoryViewer;
