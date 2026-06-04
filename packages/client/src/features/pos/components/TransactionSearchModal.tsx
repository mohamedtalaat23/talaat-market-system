import { useState, useEffect, useCallback } from 'react';
import { useModalStore } from '@/stores/modalStore';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { Search, X, Printer, RefreshCw } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const TransactionSearchModal = () => {
  const { activeModals, closeModal, openModal } = useModalStore();
  const isOpen = activeModals.pos_transaction_search;

  const [query, setQuery] = useState('');
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const searchSales = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<{ success: boolean; data: any[] }>(
        `/pos/sales/search?q=${encodeURIComponent(searchQuery)}`,
      );
      if (response.data?.success) {
        setSales(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to search transactions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      searchSales('');
      setQuery('');
    }
  }, [isOpen, searchSales]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => searchSales(query), 500);
    return () => clearTimeout(timer);
  }, [query, isOpen, searchSales]);

  if (!isOpen) return null;

  const handleReprintRequest = (sale: any) => {
    openModal('pos_manager_override', {
      action: 'reprint_receipt',
      onSuccess: async () => {
        try {
          await apiClient.post(`/pos/receipts/${sale.id}/reprint`);
          // Note: we might want to close transaction search, but let's keep it open
          // Open receipt preview so they can print it
          openModal('pos_receipt_preview', { sale });
        } catch (error) {
          toast.error('Reprint authorization failed');
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 text-foreground">
      <div
        className="absolute inset-0"
        onClick={() => closeModal('pos_transaction_search')}
        aria-hidden="true"
      />

      <div
        ref={focusTrapRef}
        className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl relative z-10 animate-fade-in flex flex-col max-h-[85vh]"
        role="dialog"
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-card-hover/50">
          <div className="flex items-center space-x-3">
            <Search className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Transaction Search & Reprint</h2>
          </div>
          <button
            onClick={() => closeModal('pos_transaction_search')}
            className="text-secondary hover:text-white p-1 rounded-md hover:bg-card-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-5 h-5" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Receipt Number..."
              className="w-full bg-background border border-border rounded-lg py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all placeholder:text-muted"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12 text-secondary">No transactions found.</div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-secondary">
                  <th className="pb-2 font-medium">Receipt No.</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Cashier</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Status</th>
                  <th className="pb-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-b border-border/50 hover:bg-card-hover/30 transition-colors"
                  >
                    <td className="py-3 font-mono text-success">{sale.receipt_number}</td>
                    <td className="py-3 text-secondary">
                      {new Date(sale.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 text-secondary">{sale.cashier_name}</td>
                    <td className="py-3 text-right font-bold">
                      EGP {Number(sale.total).toFixed(2)}
                    </td>
                    <td className="py-3 text-right">
                      {sale.print_status === 'pending_print' ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-warning/10 text-warning border border-warning/20">
                          Pending Print
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs bg-card-hover text-secondary border border-border">
                          Printed ({sale.print_count})
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleReprintRequest(sale)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-card-hover hover:bg-primary/20 text-primary rounded transition-colors text-xs font-medium"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Reprint</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export { TransactionSearchModal };
export default TransactionSearchModal;
