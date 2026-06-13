import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Printer, ToggleLeft, ToggleRight, Vault, Lock } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { usePOSStore } from '../usePOSStore';
import { useTranslation } from '@/hooks/useTranslation';

import React from 'react';

export const POSTopBar = React.memo(function POSTopBar() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { openModal } = useModalStore();
  const activeShift = usePOSStore((state) => state.activeShift);
  const autoPrintReceipts = usePOSStore((state) => state.autoPrintReceipts);
  const setAutoPrintReceipts = usePOSStore((state) => state.setAutoPrintReceipts);
  const { t } = useTranslation();

  // We can trigger the lock screen by temporarily setting idleTimeoutMs to a very short time
  // OR simply emitting a custom window event that the lockscreen or POSPage listens to.
  // Actually, setting the POSPage's isIdle state manually is easiest via window event
  const handleManualLock = () => {
    window.dispatchEvent(new Event('pos:manual-lock'));
  };

  return (
    <div className="h-16 flex items-center justify-between px-6 bg-card/80 backdrop-blur-xl border-b border-border/50 shadow-sm relative z-50">
      <div className="flex items-center gap-5">
        <button
          onClick={() => {
            openModal('pos_manager_override', {
              action: 'exit_pos',
              onSuccess: () => navigate('/'),
            });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background hover:bg-primary/10 text-secondary hover:text-primary transition-all duration-200 text-xs font-bold border border-border/60 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          title="Back to Dashboard (F12)"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('nav.dashboard')}</span>
        </button>
        <span className="font-black text-2xl tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
          {t('login.subtitle')}
        </span>
        {activeShift ? (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-success/20 text-success border border-success/30 shadow-[0_0_15px_rgba(34,197,94,0.15)] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
            {t('pos.shiftOpen')}
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-danger/20 text-danger border border-danger/30 shadow-[0_0_15px_rgba(239,68,68,0.15)] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-danger"></span>
            {t('pos.shiftClosed')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-5 text-sm text-secondary font-medium">
        <button
          onClick={() => setAutoPrintReceipts(!autoPrintReceipts)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 text-xs font-bold border ${
            autoPrintReceipts
              ? 'bg-primary/20 text-primary border-primary/40 shadow-[0_0_10px_rgba(var(--color-primary-500),0.2)]'
              : 'bg-background hover:bg-neutral-100 text-secondary border-border/60 hover:shadow-sm'
          }`}
          title="Toggle Auto-Print (Ctrl+P to print manually)"
        >
          <Printer className="w-4 h-4" />
          <span>{t('pos.autoPrint')}</span>
          {autoPrintReceipts ? (
            <ToggleRight className="w-5 h-5 text-primary" />
          ) : (
            <ToggleLeft className="w-5 h-5 text-neutral-400" />
          )}
        </button>

        <div className="w-px h-6 bg-border/60"></div>

        <div className="flex items-center gap-2">
          <span className="uppercase text-xs tracking-wider">{t('pos.cashier')}</span>
          <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
            {user?.full_name || user?.username || 'Cashier'}
          </span>
          <button
            onClick={handleManualLock}
            className="inline-flex items-center justify-center p-1.5 rounded-md text-secondary hover:bg-primary/10 hover:text-primary transition-all duration-200 ml-1"
            title="Lock POS (Switch User)"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
        <div className="w-px h-6 bg-border/60"></div>
        <div className="font-mono font-bold text-foreground bg-background px-3 py-1 rounded-md border border-border/50 shadow-inner">
          {new Date().toLocaleTimeString()}
        </div>
        {activeShift && (
          <>
            <div className="w-px h-6 bg-border/60"></div>
            <button
              onClick={() => openModal('pos_drawer_adjustment')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-warning/10 hover:bg-warning/20 text-warning transition-all duration-200 text-xs font-bold border border-warning/30 hover:shadow-[0_0_12px_rgba(234,179,8,0.2)] focus:outline-none"
              title="Drawer Actions (F9)"
            >
              <Vault className="w-4 h-4" />
              <span className="uppercase tracking-wider">Drawer</span>
            </button>
            <button
              onClick={() => openModal('pos_close_shift')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger transition-all duration-200 text-xs font-bold border border-danger/30 hover:shadow-[0_0_12px_rgba(239,68,68,0.2)] focus:outline-none"
              title="Close Shift"
            >
              <LogOut className="w-4 h-4" />
              <span className="uppercase tracking-wider">{t('pos.closeShift')}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
});
