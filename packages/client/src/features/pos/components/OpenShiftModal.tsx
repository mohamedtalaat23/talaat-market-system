import { useState } from 'react';
import { useModalStore } from '@/stores/modalStore';
import { usePOSStore } from '../usePOSStore';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { Wallet, X } from 'lucide-react';

export function OpenShiftModal() {
  const { activeModals, closeModal } = useModalStore();
  const isOpen = activeModals.pos_open_shift;
  const registerId = usePOSStore((state) => state.registerId);
  const setActiveShift = usePOSStore((state) => state.setActiveShift);
  
  const [startingCash, setStartingCash] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleOpenShift = async () => {
    const cash = parseFloat(startingCash);
    if (isNaN(cash) || cash < 0) {
      toast.error('Please enter a valid starting cash amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post<{ success: boolean; data: any }>('/pos/shifts/open', {
        starting_cash: cash,
        register_id: registerId
      });

      if (response.data?.success) {
        toast.success('Shift opened successfully');
        setActiveShift(response.data.data);
        closeModal('pos_open_shift');
        setStartingCash('');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to open shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm text-slate-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Open Register Shift</h2>
          </div>
          <button 
            onClick={() => closeModal('pos_open_shift')}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Register ID</label>
            <div className="p-3 bg-slate-800 rounded-lg text-slate-300 font-mono text-lg border border-slate-700">
              Terminal {registerId}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Starting Cash Drawer (EGP)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">£</span>
              <input 
                type="number"
                min="0"
                step="1"
                autoFocus
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOpenShift();
                  if (e.key === 'Escape') closeModal('pos_open_shift');
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-4 pl-10 pr-4 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-700"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-end space-x-3">
          <button
            onClick={() => closeModal('pos_open_shift')}
            className="px-6 py-3 rounded-lg font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleOpenShift}
            disabled={isSubmitting}
            className="px-8 py-3 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Opening...' : 'Start Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}
