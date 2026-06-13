import { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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
  ChevronLeft,
  ChevronRight,
  Bell,
  LogOut,
  Menu,
  Store,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { usePreferences } from '@/contexts/preferencesContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useLANStore } from '@/features/pos/stores/useLANStore';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { GlobalErrorBoundary } from '@/components/ui/GlobalErrorBoundary';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'manager', 'cashier'] },
  {
    label: 'Point of Sale',
    path: '/pos',
    icon: ShoppingCart,
    roles: ['admin', 'manager', 'cashier'],
  },
  { label: 'Products', path: '/products', icon: Package, roles: ['admin', 'manager'] },
  { label: 'Inventory', path: '/inventory', icon: BarChart3, roles: ['admin', 'manager'] },
  { label: 'Suppliers', path: '/suppliers', icon: Truck, roles: ['admin', 'manager'] },
  { label: 'Purchases', path: '/purchases', icon: ClipboardList, roles: ['admin', 'manager'] },
  { label: 'Customers', path: '/customers', icon: Users, roles: ['admin', 'manager', 'cashier'] },
  { label: 'Employees', path: '/employees', icon: UserCog, roles: ['admin'] },
  { label: 'Reports', path: '/reports', icon: TrendingUp, roles: ['admin', 'manager'] },
  { label: 'Settings', path: '/settings', icon: Settings, roles: ['admin'] },
] as const;

import React from 'react';

const getTranslationKey = (label: string): any => {
  const mapping: Record<string, string> = {
    Dashboard: 'nav.dashboard',
    'Point of Sale': 'nav.pos',
    Products: 'nav.products',
    Inventory: 'nav.inventory',
    Suppliers: 'nav.suppliers',
    Purchases: 'nav.purchases',
    Customers: 'nav.customers',
    Employees: 'nav.employees',
    Reports: 'nav.reports',
    Settings: 'nav.settings',
  };
  return mapping[label] || label;
};

export const AppLayout = React.memo(() => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { status: lanStatus, offlineSales } = useLANStore();
  const { language, toggleLanguage } = usePreferences();
  const { t } = useTranslation();
  const hasOfflineSales = offlineSales.length > 0;

  // Redirect to login if user object is not available
  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout for stateless client clearing
    } finally {
      logout();
      toast.success('Logged out successfully');
      navigate('/login');
    }
  };

  // Filter navigation items by employee role
  const userRole = user?.role || 'cashier';
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(userRole),
  );

  const currentPage = NAV_ITEMS.find((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={`flex flex-col bg-gradient-to-b from-[#0F2A26] to-[#0B1F1B] border-r rtl:border-r-0 rtl:border-l border-[#10B981]/10 transition-all duration-300 z-20 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.15)] ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-[72px] items-center px-5 border-b border-[#10B981]/10 gap-3 overflow-hidden select-none bg-black/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#10B981] to-emerald-600 text-white shrink-0 shadow-[0_2px_10px_rgba(16,185,129,0.3)]">
            <Store size={20} />
          </div>
          {!collapsed && (
            <div className="flex flex-col text-left rtl:text-right leading-none">
              <span className="text-sm font-black tracking-tight text-white">
                {t('login.subtitle')}
              </span>
              <span className="text-[10px] text-[#10B981] font-bold uppercase tracking-widest mt-0.5">
                {t('topbar.station')}
              </span>
            </div>
          )}
        </div>

        {/* Sidebar Nav links */}
        <nav className="flex-1 py-4 overflow-y-auto px-3 space-y-2" aria-label="Main Navigation">
          {visibleNavItems.map(({ label, path, icon: Icon }) => {
            const translatedLabel = t(getTranslationKey(label));
            return (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => {
                  const baseClasses = "flex items-center rounded-xl transition-all duration-200";
                  const expandedClasses = "gap-3 py-3 pl-[16px] pr-4 rtl:pl-4 rtl:pr-[16px] border-l-[4px] rtl:border-l-0 rtl:border-r-[4px]";
                  const collapsedClasses = "justify-center w-11 h-11 mx-auto p-0 group";
                  
                  const activeExpanded = "bg-[#10B981]/15 text-[#10B981] border-l-[#10B981] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";
                  const inactiveExpanded = "border-transparent text-white/60 hover:text-white hover:bg-white/5 font-medium";
                  
                  const activeCollapsed = "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 font-bold shadow-sm rounded-xl";
                  const inactiveCollapsed = "text-white/60 hover:text-white hover:bg-white/10 border border-transparent rounded-xl";
                  
                  return `${baseClasses} ${collapsed ? collapsedClasses : expandedClasses} ${
                    isActive
                      ? collapsed ? activeCollapsed : activeExpanded
                      : collapsed ? inactiveCollapsed : inactiveExpanded
                  }`;
                }}
                end={path === '/'}
                title={collapsed ? translatedLabel : undefined}
              >
                <Icon size={collapsed ? 22 : 18} className={`shrink-0 ${collapsed && 'transition-transform group-hover:scale-110'}`} strokeWidth={collapsed ? 2.5 : 2} />
                {!collapsed && <span className="truncate">{translatedLabel}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Collapse toggle and footer info */}
        <div className="p-4 border-t border-[#10B981]/10 flex flex-col space-y-4 bg-black/20">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center h-10 w-full rounded-xl border border-white/5 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors shadow-sm focus:outline-none"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              language === 'ar' ? (
                <ChevronLeft size={16} />
              ) : (
                <ChevronRight size={16} />
              )
            ) : language === 'ar' ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>

          {!collapsed && (
            <div className="flex items-center justify-center text-[10px] text-[#10B981]/70 font-bold uppercase tracking-widest px-1">
              <span>Station 1</span>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Workspace ────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-[72px] shrink-0 w-full items-center justify-between px-8 bg-card/80 backdrop-blur-2xl border-b border-border z-10 select-none shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="md:hidden text-secondary hover:text-foreground p-2 rounded-xl hover:bg-card-hover transition-colors focus:outline-none"
              aria-label="Toggle side drawer"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-2xl font-black tracking-tight text-foreground drop-shadow-sm">
              {currentPage ? t(getTranslationKey(currentPage.label)) : 'ERP System'}
            </h1>
          </div>

          <div className="flex items-center gap-5">
            {/* LAN Connection / Offline Sync Status */}
            <div className="hidden sm:flex items-center gap-2.5 px-4 py-2 rounded-full bg-card border border-border shadow-sm backdrop-blur-sm select-none text-[11px] font-bold tracking-wider uppercase">
              {lanStatus === 'online' ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
                  </span>
                  <Wifi size={14} className="text-success" />
                  <span className="text-foreground/80">{t('topbar.lanOnline')}</span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger"></span>
                  </span>
                  <WifiOff size={14} className="text-danger" />
                  <span className="text-danger">{t('topbar.lanOffline')}</span>
                </>
              )}
              {hasOfflineSales && (
                <>
                  <div className="h-4 w-[1px] bg-border/80 mx-1" />
                  <RefreshCw size={14} className="text-warning animate-spin" />
                  <span className="text-warning">
                    {offlineSales.length} {t('topbar.syncing')}
                  </span>
                </>
              )}
            </div>

            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="px-4 py-2 rounded-xl text-xs font-black border border-primary/20 bg-primary/5 hover:bg-primary/15 text-primary transition-all duration-200 uppercase tracking-widest shadow-sm active:scale-95 focus:outline-none"
              title={language === 'ar' ? 'Switch to English' : 'تحويل للغة العربية'}
            >
              {language === 'ar' ? 'EN' : 'عربي'}
            </button>

            {/* Notifications */}
            <button
              className="relative p-2.5 rounded-xl text-secondary hover:text-primary hover:bg-primary/10 transition-all duration-200 focus:outline-none active:scale-95"
              aria-label="View notifications"
            >
              <Bell size={20} />
              <span className="absolute top-2 right-2.5 flex h-2.5 w-2.5 rounded-full bg-danger border-2 border-card" />
            </button>

            {/* Vertical Divider */}
            <div className="h-8 w-[1px] bg-border mx-1 hidden sm:block" />

            {/* Profile Information */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-emerald-500 text-white flex items-center justify-center font-black text-lg uppercase shadow-[0_2px_10px_rgba(16,185,129,0.3)] select-none ring-2 ring-card">
                {user?.username?.charAt(0) || 'U'}
              </div>
              <div className="hidden md:flex flex-col text-left rtl:text-right justify-center">
                <span className="text-sm font-black text-foreground tracking-tight leading-none mb-1">
                  {user?.full_name || user?.username}
                </span>
                <span className="text-[10px] text-secondary font-bold uppercase tracking-widest leading-none">
                  {user?.role === 'admin'
                    ? t('dashboard.roleAdmin')
                    : user?.role === 'manager'
                      ? t('dashboard.roleManager')
                      : t('dashboard.roleCashier')}
                </span>
              </div>
            </div>

            {/* Logout Trigger */}
            <button
              onClick={handleLogout}
              className="p-2.5 ml-2 rounded-xl text-secondary hover:text-white hover:bg-danger hover:shadow-[0_4px_14px_rgba(239,68,68,0.3)] transition-all duration-200 focus:outline-none active:scale-95"
              aria-label="Log out of session"
              title="Log out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <main
          className="flex-1 overflow-y-auto p-6 focus:outline-none"
          id="main-content"
          tabIndex={-1}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <GlobalErrorBoundary>
                <Outlet />
              </GlobalErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
});

export default AppLayout;
