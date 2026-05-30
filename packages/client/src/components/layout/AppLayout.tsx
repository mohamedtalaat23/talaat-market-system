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
import { useLANStore } from '@/features/pos/stores/useLANStore';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { GlobalErrorBoundary } from '@/components/ui/GlobalErrorBoundary';

const NAV_ITEMS = [
  { label: 'Dashboard',      path: '/',           icon: LayoutDashboard, roles: ['admin', 'manager', 'cashier'] },
  { label: 'Point of Sale',  path: '/pos',        icon: ShoppingCart,    roles: ['admin', 'manager', 'cashier'] },
  { label: 'Products',       path: '/products',   icon: Package,         roles: ['admin', 'manager'] },
  { label: 'Inventory',      path: '/inventory',  icon: BarChart3,       roles: ['admin', 'manager'] },
  { label: 'Suppliers',      path: '/suppliers',  icon: Truck,           roles: ['admin', 'manager'] },
  { label: 'Purchases',      path: '/purchases',  icon: ClipboardList,   roles: ['admin', 'manager'] },
  { label: 'Customers',      path: '/customers',  icon: Users,           roles: ['admin', 'manager', 'cashier'] },
  { label: 'Employees',      path: '/employees',  icon: UserCog,         roles: ['admin'] },
  { label: 'Reports',        path: '/reports',    icon: TrendingUp,      roles: ['admin', 'manager'] },
  { label: 'Settings',       path: '/settings',   icon: Settings,        roles: ['admin'] },
] as const;

import React from 'react';

export const AppLayout = React.memo(() => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { status: lanStatus, offlineSales } = useLANStore();
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
    (item.roles as readonly string[]).includes(userRole)
  );

  const currentPage = NAV_ITEMS.find((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={`flex flex-col bg-neutral-900 border-r border-border transition-all duration-300 z-20 shrink-0 ${
          collapsed ? 'w-16' : 'w-[240px]'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-[60px] items-center px-4 border-b border-border space-x-3 overflow-hidden select-none">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0 shadow-glow">
            <Store size={18} />
          </div>
          {!collapsed && (
            <div className="flex flex-col text-left leading-none">
              <span className="text-sm font-bold tracking-tight text-foreground">Talaat Market</span>
              <span className="text-[10px] text-neutral-400 font-medium">Supermarket ERP</span>
            </div>
          )}
        </div>

        {/* Sidebar Nav links */}
        <nav className="flex-1 py-4 overflow-y-auto px-3 space-y-1.5" aria-label="Main Navigation">
          {visibleNavItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/10 text-primary border-l-2 border-primary pl-2'
                    : 'text-neutral-400 hover:text-foreground hover:bg-neutral-800/50'
                }`
              }
              end={path === '/'}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" strokeWidth={2} />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle and footer info */}
        <div className="p-3 border-t border-border flex flex-col space-y-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center h-9 w-full rounded-md border border-neutral-800 text-neutral-400 hover:text-foreground hover:bg-neutral-800/80 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          
          {!collapsed && (
            <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono px-1">
              <span>Station 1</span>
              <span>v1.0.0</span>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Workspace ────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-[60px] w-full items-center justify-between px-6 bg-neutral-900/20 border-b border-border backdrop-blur-sm z-10 select-none">
          <div className="flex items-center space-x-3">
            <button
              className="md:hidden text-neutral-400 hover:text-foreground"
              aria-label="Toggle side drawer"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              {currentPage?.label ?? 'ERP System'}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* LAN Connection / Offline Sync Status */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-neutral-800/40 border border-neutral-700/50 backdrop-blur-sm select-none text-xs font-medium">
              {lanStatus === 'online' ? (
                <>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <Wifi size={14} className="text-emerald-500" />
                  <span className="text-neutral-300">LAN Online</span>
                </>
              ) : (
                <>
                  <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <WifiOff size={14} className="text-rose-500" />
                  <span className="text-rose-400">LAN Offline</span>
                </>
              )}
              {hasOfflineSales && (
                <>
                  <div className="h-3 w-[1px] bg-neutral-700 mx-1" />
                  <RefreshCw size={12} className="text-amber-500 animate-spin" />
                  <span className="text-amber-400 font-semibold">{offlineSales.length} Syncing</span>
                </>
              )}
            </div>

            {/* Notifications */}
            <button
              className="relative p-1.5 rounded-full text-neutral-400 hover:text-foreground hover:bg-neutral-800/50 transition-colors"
              aria-label="View notifications"
            >
              <Bell size={18} />
              <span className="absolute top-0.5 right-0.5 flex h-2 w-2 rounded-full bg-primary" />
            </button>

            {/* Vertical Divider */}
            <div className="h-5 w-[1px] bg-border" />

            {/* Profile Information */}
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-sm uppercase shadow-sm select-none">
                {user?.username?.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-foreground leading-tight">
                  {user?.full_name || user?.username}
                </span>
                <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">
                  {user?.role}
                </span>
              </div>
            </div>

            {/* Logout Trigger */}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-full text-neutral-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Log out of session"
              title="Log out"
            >
              <LogOut size={18} />
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
