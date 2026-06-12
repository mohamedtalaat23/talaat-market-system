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
    <div className="h-14 flex items-center justify-between px-6 bg-card border-b border-border">
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            openModal('pos_manager_override', {
              action: 'exit_pos',
              onSuccess: () => navigate('/'),
            });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-card-hover hover:bg-border text-secondary hover:text-foreground transition-colors text-xs font-medium border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          title="Back to Dashboard (F12)"
        >
          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          <span>{t('nav.dashboard')}</span>
        </button>
        <span className="font-bold text-xl tracking-tight text-foreground">
          {t('login.subtitle')}
        </span>
        {activeShift ? (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-success/15 text-success border border-success/30">
            {t('pos.shiftOpen')}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-danger/15 text-danger border border-danger/30">
            {t('pos.shiftClosed')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm text-secondary">
        <button
          onClick={() => setAutoPrintReceipts(!autoPrintReceipts)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-xs font-medium border ${
            autoPrintReceipts
              ? 'bg-primary/15 text-primary border-primary/30'
              : 'bg-card-hover text-secondary border-border'
          }`}
          title="Toggle Auto-Print (Ctrl+P to print manually)"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{t('pos.autoPrint')}</span>
          {autoPrintReceipts ? (
            <ToggleRight className="w-4 h-4 text-primary" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-muted" />
          )}
        </button>

        <div className="w-px h-4 bg-border"></div>

        <div>
          {t('pos.cashier')}:{' '}
          <span className="text-foreground font-semibold">
            {user?.full_name || user?.username || 'Cashier'}
          </span>
          <button
            onClick={handleManualLock}
            className="ml-2 inline-flex items-center justify-center p-1 rounded-md text-secondary hover:bg-card-hover hover:text-foreground transition-colors"
            title="Lock POS (Switch User)"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="w-px h-4 bg-border"></div>
        <div>{new Date().toLocaleTimeString()}</div>
        {activeShift && (
          <>
            <div className="w-px h-4 bg-border"></div>
            <button
              onClick={() => openModal('pos_drawer_adjustment')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-warning/15 hover:bg-warning/25 text-warning transition-colors text-xs font-medium border border-warning/30 hover:border-warning/45 focus:outline-none"
              title="Drawer Actions (F9)"
            >
              <Vault className="w-3.5 h-3.5" />
              <span>Drawer</span>
            </button>
            <button
              onClick={() => openModal('pos_close_shift')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-danger/15 hover:bg-danger/25 text-danger transition-colors text-xs font-medium border border-danger/30 hover:border-danger/45 focus:outline-none"
              title="Close Shift"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('pos.closeShift')}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
});
