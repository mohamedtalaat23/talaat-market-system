import { LockKeyhole } from 'lucide-react';
import { usePOSStore } from '../usePOSStore';
import { useModalStore } from '@/stores/modalStore';
import { useNavigate } from 'react-router-dom';

export function NoShiftOverlay() {
  const activeShift = usePOSStore((state) => state.activeShift);
  const registerId = usePOSStore((state) => state.registerId);
  const { openModal } = useModalStore();
  const navigate = useNavigate();

  if (activeShift) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md text-foreground">
      <div className="flex flex-col items-center bg-card border border-border rounded-xl p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border border-border shadow-inner">
          <LockKeyhole className="w-10 h-10 text-emerald-500" />
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white">POS Locked</h2>
          <p className="text-secondary">
            Register {registerId} requires an active shift to operate.
          </p>
        </div>

        <div className="w-full space-y-3">
          <button 
            onClick={() => openModal('pos_open_shift')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            Open Shift
          </button>
          
          <button 
            onClick={() => openModal('pos_manager_override', { action: 'exit_pos', onSuccess: () => navigate('/') })}
            className="w-full bg-transparent border border-border hover:bg-card-hover text-secondary font-semibold py-3 rounded-lg transition-all active:scale-95"
          >
            Exit to Dashboard
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Supermarket Management System &bull; Talaat Market
        </p>
      </div>
    </div>
  );
}
