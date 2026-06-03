import { useState, useEffect } from 'react';
import { useModalStore } from '@/stores/modalStore';
import { usePOSStore } from '../usePOSStore';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { Lock, X, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useLANStore } from '../stores/useLANStore';

export function CloseShiftModal() {
  const { activeModals, closeModal, openModal, modalPayloads } = useModalStore();
  const isOpen = activeModals.pos_close_shift;
  const activeShift = usePOSStore((state) => state.activeShift);
  const setActiveShift = usePOSStore((state) => state.setActiveShift);
  const heldCarts = usePOSStore((state) => state.heldCarts);
  const user = useAuthStore((state) => state.user);
  
  const [endingCash, setEndingCash] = useState<string>('');
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsOverride, setNeedsOverride] = useState(false);

  useEffect(() => {
    if (isOpen && activeShift) {
      fetchSummary();
      setEndingCash('');
      setNeedsOverride(false);
    }
  }, [isOpen, activeShift]);

  // Check for successful manager override
  useEffect(() => {
    if (isOpen && needsOverride && modalPayloads.pos_close_shift?.override_granted) {
      setNeedsOverride(false); // Override granted
    }
  }, [isOpen, needsOverride, modalPayloads.pos_close_shift]);

  const fetchSummary = async () => {
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
          expected_cash: Number(activeShift.starting_cash || 0) + Number(activeShift.cash_sales || 0),
          pending_prints: 0
        };
        setSummary(localSummary);
        
        const myHeldCarts = heldCarts.filter(c => c.cashier_id === user?.id);
        if (myHeldCarts.length > 0) {
          setNeedsOverride(true);
        }
        setIsLoading(false);
        return;
      }

      const response = await apiClient.get<{ success: boolean; data: any }>(`/pos/shifts/${activeShift.id}/summary`);
      if (response.data?.success) {
        const data = response.data.data;
        setSummary(data);
        
        // Safety Validation
        const myHeldCarts = heldCarts.filter(c => c.cashier_id === user?.id);
        if (data.pending_prints > 0 || myHeldCarts.length > 0) {
          setNeedsOverride(true);
        }
      }
    } catch (error) {
      toast.error('Failed to fetch shift summary');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCloseShift = async () => {
    if (needsOverride) {
      openModal('pos_manager_override', { 
        action: 'force_close_shift',
        onSuccess: () => {
          // Setting this payload allows the useEffect to clear needsOverride
          openModal('pos_close_shift', { override_granted: true });
        }
      });
      return;
    }

    const cash = parseFloat(endingCash);
    if (isNaN(cash) || cash < 0) {
      toast.error('Please enter the actual cash counted');
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
          notes: 'Offline cashier shift closure'
        },
        timestamp: new Date().toISOString()
      });
      
      toast.success('Shift closed locally. Synching in background...', { icon: '💾', duration: 4000 });
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
        notes: ''
      });

      if (response.data?.success) {
        toast.success('Shift closed successfully');
        setActiveShift(null);
        closeModal('pos_close_shift');
      }
    } catch (error: any) {
      const isNetworkError = !error.response || error.message?.includes('Network Error') || error.status === undefined || error.status >= 500;
      
      if (mode === 'client' && isNetworkError) {
        toast.error('Network connection to Master server failed. Routing to local shift buffer...', { duration: 4000 });
        setStatus('offline');
        addOfflineShiftClosure({
          id: crypto.randomUUID(),
          payload: {
            shift_id: activeShift.id,
            ending_cash: cash,
            expected_cash: summary?.expected_cash || 0,
            notes: 'Offline shift closure fallback'
          },
          timestamp: new Date().toISOString()
        });
        setActiveShift(null);
        closeModal('pos_close_shift');
      } else {
        toast.error(error.message || 'Failed to close shift');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const myHeldCarts = heldCarts.filter(c => c.cashier_id === user?.id);
  const discrepancy = summary ? parseFloat(endingCash || '0') - summary.expected_cash : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm text-foreground">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <Lock className="w-5 h-5 text-rose-400" />
            <h2 className="text-lg font-semibold text-white">Close Shift Report</h2>
          </div>
          <button 
            onClick={() => closeModal('pos_close_shift')}
            className="text-secondary hover:text-white p-1 rounded-md hover:bg-card-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : summary ? (
            <>
              {needsOverride && (
                <div className="bg-amber-950/50 border border-amber-900/50 rounded-lg p-4 flex items-start space-x-3 text-amber-200">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                  <div className="text-sm space-y-1">
                    <p className="font-semibold text-amber-400">Operational Warnings Detected</p>
                    {summary.pending_prints > 0 && <p>• {summary.pending_prints} receipt(s) pending print recovery.</p>}
                    {myHeldCarts.length > 0 && <p>• {myHeldCarts.length} cart(s) currently suspended.</p>}
                    <p className="pt-2 text-amber-300">Manager override is required to force close this shift.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background border border-border rounded-lg p-4 space-y-1">
                  <p className="text-sm text-secondary">Starting Cash</p>
                  <p className="text-xl font-bold font-mono">EGP {summary.starting_cash.toFixed(2)}</p>
                </div>
                <div className="bg-background border border-border rounded-lg p-4 space-y-1">
                  <p className="text-sm text-secondary">Cash Sales</p>
                  <p className="text-xl font-bold text-emerald-400 font-mono">+EGP {summary.cash_sales.toFixed(2)}</p>
                </div>
                <div className="bg-background border border-border rounded-lg p-4 space-y-1">
                  <p className="text-sm text-secondary">Card Sales</p>
                  <p className="text-xl font-bold text-blue-400 font-mono">EGP {summary.card_sales.toFixed(2)}</p>
                </div>
                <div className="bg-background border border-border rounded-lg p-4 space-y-1">
                  <p className="text-sm text-secondary">Expected Cash in Drawer</p>
                  <p className="text-2xl font-bold text-white font-mono">EGP {summary.expected_cash.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-sm font-medium text-secondary flex justify-between">
                  <span>Actual Cash Counted (EGP)</span>
                  {endingCash && (
                    <span className={`font-mono ${discrepancy < 0 ? 'text-rose-400' : discrepancy > 0 ? 'text-emerald-400' : 'text-secondary'}`}>
                      Diff: {discrepancy > 0 ? '+' : ''}{discrepancy.toFixed(2)}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">EGP</span>
                  <input 
                    type="number"
                    min="0"
                    step="1"
                    autoFocus
                    value={endingCash}
                    onChange={(e) => setEndingCash(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCloseShift();
                      if (e.key === 'Escape') closeModal('pos_close_shift');
                    }}
                    className="w-full bg-background border border-border rounded-lg py-4 pl-10 pr-4 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all placeholder:text-slate-700"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-secondary text-center">No summary data available.</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-slate-800/30 flex justify-end space-x-3">
          <button
            onClick={() => closeModal('pos_close_shift')}
            className="px-6 py-3 rounded-lg font-medium text-secondary bg-slate-800 hover:bg-card-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCloseShift}
            disabled={isSubmitting || isLoading || (!endingCash && !needsOverride)}
            className={`px-8 py-3 rounded-lg font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              needsOverride ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
            }`}
          >
            {isSubmitting ? 'Processing...' : needsOverride ? 'Manager Override Required' : 'Close Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}
