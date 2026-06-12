import { useState, useEffect } from 'react';
import { useModalStore } from '@/stores/modalStore';
import { usePOSStore } from '../usePOSStore';
import { X, Vault, ArrowDownRight, ArrowUpRight, FileText } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const ADJUSTMENT_TYPES = [
  { value: 'safe_drop', label: 'Safe Drop', type: 'out', icon: Vault, color: 'text-danger' },
  { value: 'petty_cash', label: 'Petty Cash', type: 'out', icon: ArrowUpRight, color: 'text-danger' },
  { value: 'vendor_payment', label: 'Vendor Payment', type: 'out', icon: ArrowUpRight, color: 'text-danger' },
  { value: 'owner_withdrawal', label: 'Owner Withdrawal', type: 'out', icon: ArrowUpRight, color: 'text-danger' },
  { value: 'cash_correction_out', label: 'Cash Correction (OUT)', type: 'out', icon: ArrowUpRight, color: 'text-danger' },
  { value: 'change_replenishment', label: 'Change Replenishment', type: 'in', icon: ArrowDownRight, color: 'text-success' },
  { value: 'cash_correction_in', label: 'Cash Correction (IN)', type: 'in', icon: ArrowDownRight, color: 'text-success' },
];

export function DrawerAdjustmentModal() {
  const { activeModals, closeModal, openModal } = useModalStore();
  const isOpen = activeModals.pos_drawer_adjustment;
  const activeShift = usePOSStore((state) => state.activeShift);
  const setActiveShift = usePOSStore((state) => state.setActiveShift);

  const [type, setType] = useState('safe_drop');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setType('safe_drop');
      setAmount('');
      setNotes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedTypeObj = ADJUSTMENT_TYPES.find((t) => t.value === type);
  const isOut = selectedTypeObj?.type === 'out';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;
    if (!activeShift) return;

    openModal('pos_manager_override', {
      action: 'drawer_adjustment',
      displayMetadata: {
        title: selectedTypeObj?.label,
        amount: numericAmount,
        direction: isOut ? 'OUT' : 'IN'
      },
      onSuccess: async (managerId: number) => {
        try {
          const { apiClient } = await import('@/services/api-client');
          const toast = (await import('react-hot-toast')).default;

          const payload = {
            manager_id: managerId,
            type: type,
            amount: numericAmount,
            reason_code: type.toUpperCase(),
            reason_notes: notes || null,
          };

          const response = await apiClient.post(`/pos/shifts/${activeShift.id}/adjustments`, payload);
          if (response.data?.success) {
            toast.success('Drawer adjustment recorded');
            
            // Re-fetch shift to update expected cash
            const shiftRes = await apiClient.get('/pos/shifts/current');
            if (shiftRes.data?.success) {
              setActiveShift(shiftRes.data.data);
            }
            
            closeModal('pos_drawer_adjustment');
          }
        } catch (error: any) {
          const toast = (await import('react-hot-toast')).default;
          toast.error(error.response?.data?.message || 'Failed to record adjustment');
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 text-input-text">
      <div className="absolute inset-0" onClick={() => closeModal('pos_drawer_adjustment')} />
      <div ref={focusTrapRef} className="w-full max-w-md bg-card border border-input-border rounded-xl shadow-2xl relative z-10 animate-fade-in flex flex-col">
        
        <div className="flex items-center justify-between p-4 border-b border-input-border bg-card-hover/50">
          <div className="flex items-center space-x-3">
            <Vault className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Drawer Adjustment</h2>
          </div>
          <button onClick={() => closeModal('pos_drawer_adjustment')} className="text-secondary hover:text-white p-1 rounded-md hover:bg-card-hover transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Adjustment Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-input-bg border border-input-border rounded-lg py-2.5 px-3 text-input-text focus:outline-none focus:border-input-focus focus:ring-1 focus:ring-primary/20 transition-all"
            >
              <optgroup label="Money Out">
                {ADJUSTMENT_TYPES.filter(t => t.type === 'out').map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
              <optgroup label="Money In">
                {ADJUSTMENT_TYPES.filter(t => t.type === 'in').map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Amount (EGP)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-secondary sm:text-sm">EGP</span>
              </div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                className={`w-full bg-input-bg border ${isOut ? 'border-danger/50 focus:border-danger focus:ring-danger' : 'border-success/50 focus:border-success focus:ring-success'} rounded-lg py-3 pl-12 pr-4 text-input-text text-xl font-mono focus:outline-none focus:ring-1 transition-all`}
                placeholder="0.00"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                {selectedTypeObj && <selectedTypeObj.icon className={`w-5 h-5 ${selectedTypeObj.color}`} />}
              </div>
            </div>
            {isOut && (
              <p className="mt-1 text-xs text-danger/80 text-right">This will decrease expected cash in drawer.</p>
            )}
            {!isOut && (
              <p className="mt-1 text-xs text-success/80 text-right">This will increase expected cash in drawer.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Notes (Optional)</label>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none">
                <FileText className="w-4 h-4 text-secondary/50" />
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-input-bg border border-input-border rounded-lg py-2 pl-9 pr-3 text-input-text text-sm focus:outline-none focus:border-input-focus focus:ring-1 focus:ring-primary/20 transition-all resize-none"
                placeholder="Manager authorization required"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-input-border">
            <button
              type="submit"
              disabled={!amount || parseFloat(amount) <= 0}
              className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isOut ? 'bg-danger hover:bg-danger/90' : 'bg-success hover:bg-success/90'}`}
            >
              Authorize & {isOut ? 'Withdraw' : 'Deposit'} {amount ? `EGP ${amount}` : ''}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

export default DrawerAdjustmentModal;
