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
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight mb-4 text-foreground px-2">
          {t('settings.title')}
        </h2>
        <nav className="flex flex-col gap-1">
          {TABS.map(({ path, key, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-secondary hover:text-foreground hover:bg-card-hover'
                }`
              }
            >
              <Icon size={18} />
              {t(key)}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
