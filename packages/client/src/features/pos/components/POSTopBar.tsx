

import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Printer, ToggleLeft, ToggleRight } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { usePOSStore } from '../usePOSStore';

import React from 'react';

export const POSTopBar = React.memo(function POSTopBar() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { openModal } = useModalStore();
  const activeShift = usePOSStore((state) => state.activeShift);
  const autoPrintReceipts = usePOSStore((state) => state.autoPrintReceipts);
  const setAutoPrintReceipts = usePOSStore((state) => state.setAutoPrintReceipts);

  return (
    <div className="h-14 flex items-center justify-between px-6 bg-slate-900 border-b border-slate-800">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => {
            openModal('pos_manager_override', {
              action: 'exit_pos',
              onSuccess: () => navigate('/')
            });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs font-medium border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-500"
          title="Back to Dashboard (F12)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>
        <span className="font-bold text-xl tracking-tight text-white">Talaat POS</span>
        {activeShift ? (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            SHIFT OPEN
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            SHIFT CLOSED
          </span>
        )}
      </div>
      <div className="flex items-center space-x-4 text-sm text-slate-400">
        <button
          onClick={() => setAutoPrintReceipts(!autoPrintReceipts)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-xs font-medium border ${
            autoPrintReceipts 
              ? 'bg-blue-900/50 text-blue-200 border-blue-800' 
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
          title="Toggle Auto-Print (Ctrl+P to print manually)"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Auto-Print</span>
          {autoPrintReceipts ? (
            <ToggleRight className="w-4 h-4 text-blue-400" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-slate-500" />
          )}
        </button>

        <div className="w-px h-4 bg-slate-700"></div>

        <div>Cashier: <span className="text-white font-medium">{user?.full_name || user?.username || 'Cashier'}</span></div>
        <div className="w-px h-4 bg-slate-700"></div>
        <div>{new Date().toLocaleTimeString()}</div>
        {activeShift && (
          <>
            <div className="w-px h-4 bg-slate-700"></div>
            <button
              onClick={() => openModal('pos_close_shift')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-900/50 hover:bg-rose-800/80 text-rose-200 transition-colors text-xs font-medium border border-rose-800 hover:border-rose-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
              title="Close Shift"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Close Shift</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
});

