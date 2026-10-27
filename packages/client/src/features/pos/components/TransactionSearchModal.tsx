import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalStore } from '@/stores/modalStore';
import { Search, X, Printer, RefreshCw, RefreshCcw } from 'lucide-react';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useTranslation } from '@/hooks/useTranslation';

const TransactionSearchModal = () => {
  const { t } = useTranslation();
  const { activeModals, closeModal, openModal } = useModalStore();
  const isOpen = activeModals.pos_transaction_search;

  const [query, setQuery] = useState('');
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const lastSearchedQueryRef = useRef<string | null>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const searchSales = useCallback(async (searchQuery: string) => {
    if (searchQuery === lastSearchedQueryRef.current) return;
    lastSearchedQueryRef.current = searchQuery;
    setIsLoading(true);
    try {
      const response = await apiClient.get<{ success: boolean; data: any[] }>(
        `/pos/sales/search?q=${encodeURIComponent(searchQuery)}`,
      );
      if (response.data?.success) {
        setSales(response.data.data);
      }
    } catch {
      toast.error(t('pos.toasts.failedSearchTransactions'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isOpen) {
      // Drop the cached query only; resetting state here would re-render on
      // every effect run (the effect depends on `searchSales`) and loop.
      lastSearchedQueryRef.current = null;
      return;
    }
    lastSearchedQueryRef.current = null;
    searchSales('');
    setQuery('');
  }, [isOpen, searchSales]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => searchSales(query), 500);
    return () => clearTimeout(timer);
  }, [query, isOpen, searchSales]);

  const handleReprintRequest = (sale: any) => {
    openModal('pos_manager_override', {
      action: 'reprint_receipt',
      onSuccess: async () => {
        try {
          await apiClient.post(`/pos/receipts/${sale.id}/reprint`);
          // Note: we might want to close transaction search, but let's keep it open
          // Open receipt preview so they can print it
          openModal('pos_receipt_preview', { sale });
        } catch {
          toast.error(t('pos.toasts.reprintAuthFailed'));
        }
      },
    });
  };

  const isActuallyLoading = isLoading || lastSearchedQueryRef.current === null;
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isActuallyLoading) {
      timer = setTimeout(() => setShowSpinner(true), 150);
    } else {
      setShowSpinner(false);
    }
    return () => clearTimeout(timer);
  }, [isActuallyLoading]);

  // Every hook above must run on each render (React hooks order), so the
  // "closed" early return lives *after* them — returning early before a hook
  // throws "Rendered more hooks than during the previous render" on open.
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-foreground">
      <div
        className="absolute inset-0"
        onClick={() => closeModal('pos_transaction_search')}
        aria-hidden="true"
      />

      <div
        ref={focusTrapRef}
        className="w-full max-w-4xl bg-card border border-border/40 rounded-3xl shadow-2xl shadow-black/20 relative z-10 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] overflow-hidden"
        role="dialog"
      >
        <div className="flex items-center justify-between p-6 border-b border-border/40 bg-muted/20">
          <div className="flex items-center space-x-3.5">
            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-sm">
              <Search className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-foreground">
              {t('pos.transactionSearchTitle')}
            </h2>
          </div>
          <button
            onClick={() => closeModal('pos_transaction_search')}
            className="text-secondary hover:text-foreground p-2 rounded-xl hover:bg-card border border-transparent hover:border-border/60 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b border-border/40 bg-muted/10">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/60 w-5 h-5 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('pos.searchReceiptNo')}
              className="w-full bg-card border border-border/60 rounded-xl py-3.5 pl-12 pr-4 text-foreground text-sm font-bold shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/50 placeholder:font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-muted/5 custom-scrollbar p-6">
          {showSpinner ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <RefreshCw className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-sm font-bold text-secondary uppercase tracking-widest">
                {t('pos.searching')}
              </p>
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-secondary">
              <div className="p-4 bg-secondary/5 rounded-full mb-3 border border-secondary/10">
                <Search className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-sm font-bold tracking-wide">{t('pos.noTransactionsFound')}</p>
            </div>
          ) : (
            <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/40 sticky top-0 z-10 backdrop-blur-md">
                  <tr className="border-b border-border/60 text-[11px] font-black text-secondary uppercase tracking-widest">
                    <th className="py-4 px-5">{t('pos.receiptNo').replace(':', '')}</th>
                    <th className="py-4 px-5">{t('reports.date')}</th>
                    <th className="py-4 px-5">{t('pos.cashier')}</th>
                    <th className="py-4 px-5 text-right">{t('pos.total')}</th>
                    <th className="py-4 px-5 text-right">{t('common.status')}</th>
                    <th className="py-4 px-5 text-center">{t('pos.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="group hover:bg-primary/[0.02] transition-colors">
                      <td className="py-4 px-5 font-mono font-bold text-foreground text-xs">
                        {sale.receipt_number}
                      </td>
                      <td className="py-4 px-5 text-xs text-secondary font-medium">
                        {new Date(sale.created_at).toLocaleString()}
                      </td>
                      <td className="py-4 px-5 text-secondary font-medium text-xs">
                        {sale.cashier_name}
                      </td>
                      <td className="py-4 px-5 text-right font-black text-foreground tabular-nums">
                        {Number(sale.total).toFixed(2)}{' '}
                        <span className="text-[10px] text-secondary ml-0.5">{t('pos.currency')}</span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        {sale.print_status === 'pending_print' ? (
                          <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-black bg-warning/10 text-warning border border-warning/20 uppercase tracking-widest">
                            {t('pos.pendingPrint')}
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-black bg-secondary/10 text-secondary border border-secondary/20 uppercase tracking-widest">
                            {t('pos.printedCount').replace('{count}', String(sale.print_count))}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex justify-center space-x-2.5">
                          {['completed', 'partially_refunded'].includes(sale.status) && (
                            <button
                              onClick={() => openModal('pos_refund', { sale })}
                              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-warning/10 hover:bg-warning/20 text-warning border border-warning/30 rounded-lg transition-all text-xs font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5"
                            >
                              <RefreshCcw className="w-3.5 h-3.5" />
                              <span>{t('pos.refundVoid')}</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleReprintRequest(sale)}
                            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-card hover:bg-primary/10 text-secondary hover:text-primary border border-border/60 hover:border-primary/30 rounded-lg transition-all text-xs font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>{t('pos.reprint')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export { TransactionSearchModal };
export default TransactionSearchModal;
