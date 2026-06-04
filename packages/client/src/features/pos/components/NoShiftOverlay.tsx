import { LockKeyhole } from 'lucide-react';
import { usePOSStore } from '../usePOSStore';
import { useModalStore } from '@/stores/modalStore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';

export function NoShiftOverlay() {
  const { t } = useTranslation();
  const activeShift = usePOSStore((state) => state.activeShift);
  const registerId = usePOSStore((state) => state.registerId);
  const { openModal } = useModalStore();
  const navigate = useNavigate();

  if (activeShift) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md text-foreground">
      <div className="flex flex-col items-center bg-card border border-border rounded-xl p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="w-20 h-20 bg-success/15 rounded-full flex items-center justify-center border border-success/30 shadow-inner">
          <LockKeyhole className="w-10 h-10 text-success" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {t('pos.posLocked')}
          </h2>
          <p className="text-secondary">
            {t('pos.posLockedDesc').replace('{id}', String(registerId))}
          </p>
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={() => openModal('pos_open_shift')}
            className="w-full bg-success hover:bg-success/90 text-white font-semibold py-4 rounded-lg shadow-lg shadow-success/20 transition-all active:scale-95"
          >
            {t('pos.openShift')}
          </button>

          <button
            onClick={() =>
              openModal('pos_manager_override', {
                action: 'exit_pos',
                onSuccess: () => navigate('/'),
              })
            }
            className="w-full bg-transparent border border-border hover:bg-card-hover text-secondary hover:text-foreground font-semibold py-3 rounded-lg transition-all active:scale-95"
          >
            {t('pos.exitDashboard')}
          </button>
        </div>

        <p className="text-xs text-muted">{t('login.subtitle')}</p>
      </div>
    </div>
  );
}
