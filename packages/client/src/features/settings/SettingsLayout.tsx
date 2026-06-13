import { Outlet, NavLink } from 'react-router-dom';
import { Store, Receipt, MonitorSpeaker, Printer, Wifi, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const TABS = [
  { path: 'general', key: 'settings.general', icon: Store },
  { path: 'pos', key: 'settings.pos', icon: SlidersHorizontal },
  { path: 'receipts', key: 'settings.receipts', icon: Receipt },
  { path: 'registers', key: 'settings.registers', icon: MonitorSpeaker },
  { path: 'printers', key: 'settings.printers', icon: Printer },
  { path: 'lan', key: 'settings.lan', icon: Wifi },
] as const;

export function SettingsLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full gap-6">
      <div className="w-64 shrink-0 flex flex-col gap-3">
        <h2 className="text-2xl font-black tracking-tight mb-2 text-foreground px-2">
          {t('settings.title')}
        </h2>
        <nav className="flex flex-col gap-1.5">
          {TABS.map(({ path, key, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-secondary hover:text-foreground hover:bg-white dark:hover:bg-card hover:shadow-sm'
                }`
              }
            >
              <Icon size={18} />
              {t(key)}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex-1 bg-white/60 dark:bg-card/60 backdrop-blur-xl border border-border/40 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-2xl overflow-hidden flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
