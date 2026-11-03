import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Truck,
  ClipboardList,
  Users,
  UserCog,
  TrendingUp,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Store,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { usePreferences } from '@/contexts/preferencesContext';
import { useTranslation } from '@/hooks/useTranslation';
import { apiClient } from '@/services/api-client';
import { GlobalErrorBoundary } from '@/components/ui/GlobalErrorBoundary';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';

const groups = [
  {
    en: 'Workspace',
    ar: 'مساحة العمل',
    items: [
      {
        key: 'dashboard',
        path: '/',
        icon: LayoutDashboard,
        roles: ['admin', 'manager', 'cashier'],
      },
      { key: 'pos', path: '/pos', icon: ShoppingCart, roles: ['admin', 'manager', 'cashier'] },
    ],
  },
  {
    en: 'Stock & purchasing',
    ar: 'المخزون والمشتريات',
    items: [
      { key: 'products', path: '/products', icon: Package, roles: ['admin', 'manager'] },
      { key: 'inventory', path: '/inventory', icon: BarChart3, roles: ['admin', 'manager'] },
      { key: 'suppliers', path: '/suppliers', icon: Truck, roles: ['admin', 'manager'] },
      { key: 'purchases', path: '/purchases', icon: ClipboardList, roles: ['admin', 'manager'] },
    ],
  },
  {
    en: 'Business',
    ar: 'إدارة المتجر',
    items: [
      { key: 'customers', path: '/customers', icon: Users, roles: ['admin', 'manager', 'cashier'] },
      { key: 'reports', path: '/reports', icon: TrendingUp, roles: ['admin', 'manager'] },
      { key: 'employees', path: '/employees', icon: UserCog, roles: ['admin'] },
      { key: 'settings', path: '/settings', icon: Settings, roles: ['admin'] },
    ],
  },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { language, toggleLanguage } = usePreferences();
  const { t } = useTranslation();
  const ar = language === 'ar';
  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      logout();
      void navigate('/login');
    }
  };
  return (
    <div className="retail-shell">
      <a className="skip-link" href="#main-content">
        {ar ? 'انتقل إلى المحتوى' : 'Skip to content'}
      </a>
      <aside className={`retail-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="retail-brand">
          <Store size={26} aria-hidden="true" />
          {!collapsed && (
            <div>
              <strong>{ar ? 'أسواق طلعت' : 'Talaat Market'}</strong>
              <span>{ar ? 'إدارة المتجر' : 'STORE OPERATIONS'}</span>
            </div>
          )}
        </div>
        <nav aria-label={ar ? 'التنقل الرئيسي' : 'Main navigation'}>
          {groups.map((group) => {
            const items = group.items.filter((item) =>
              item.roles.includes(user?.role || 'cashier'),
            );
            return (
              items.length > 0 && (
                <section key={group.en}>
                  {!collapsed && <h2>{ar ? group.ar : group.en}</h2>}
                  {items.map(({ key, path, icon: Icon }) => (
                    <NavLink
                      key={path}
                      to={path}
                      end={path === '/'}
                      title={collapsed ? t(`nav.${key}`) : undefined}
                      aria-label={t(`nav.${key}`)}
                      className={({ isActive }) => `retail-nav-item ${isActive ? 'is-active' : ''}`}
                    >
                      <Icon size={19} aria-hidden="true" />
                      {!collapsed && <span>{t(`nav.${key}`)}</span>}
                    </NavLink>
                  ))}
                </section>
              )
            );
          })}
        </nav>
        <button
          className="retail-collapse"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={ar ? 'تبديل القائمة الجانبية' : 'Toggle sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeftOpen size={19} />
          ) : (
            <>
              <PanelLeftClose size={19} />
              <span>{ar ? 'طي القائمة' : 'Collapse navigation'}</span>
            </>
          )}
        </button>
      </aside>
      <div className="retail-workspace">
        <header className="retail-toolbar">
          <ConnectionStatus />
          <div className="flex items-center gap-4">
            <button
              className="retail-language"
              onClick={toggleLanguage}
              aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              {ar ? 'English' : 'العربية'}
            </button>
            <div className="retail-user">
              <strong>{user?.full_name || user?.username}</strong>
              <span>
                {t(
                  user?.role === 'admin'
                    ? 'dashboard.roleAdmin'
                    : user?.role === 'manager'
                      ? 'dashboard.roleManager'
                      : 'dashboard.roleCashier',
                )}
              </span>
            </div>
            <button
              className="retail-icon-button"
              onClick={() => void handleLogout().catch(() => undefined)}
              aria-label={ar ? 'تسجيل الخروج' : 'Log out'}
              title={ar ? 'تسجيل الخروج' : 'Log out'}
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="retail-main">
          <GlobalErrorBoundary>
            <Outlet />
          </GlobalErrorBoundary>
        </main>
      </div>
    </div>
  );
}
export default AppLayout;
