import { LockKeyhole } from 'lucide-react';
import { usePOSStore } from '../usePOSStore';
import { useModalStore } from '@/stores/modalStore';

export function NoShiftOverlay() {
  const activeShift = usePOSStore((state) => state.activeShift);
  const registerId = usePOSStore((state) => state.registerId);
  const { openModal } = useModalStore();

  if (activeShift) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md text-slate-200">
      <div className="flex flex-col items-center bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 shadow-inner">
          <LockKeyhole className="w-10 h-10 text-emerald-500" />
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white">POS Locked</h2>
          <p className="text-slate-400">
            Register {registerId} requires an active shift to operate.
          </p>
        </div>

        <button 
          onClick={() => openModal('pos_open_shift')}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
        >
          Open Shift
        </button>

        <p className="text-xs text-slate-500">
          Supermarket Management System &bull; Talaat Market
        </p>
      </div>
    </div>
  );
}
