import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import styles from './AppLayout.module.css';

// Navigation items — roles array controls visibility (enforced in Phase 3: Auth)
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

/**
 * AppLayout — the persistent shell wrapping all authenticated pages.
 *
 * Structure:
 *   ┌─────────────┬──────────────────────────┐
 *   │  Sidebar    │  Header                  │
 *   │  (nav)      ├──────────────────────────┤
 *   │             │  Main Content Area       │
 *   │             │  (children rendered here)│
 *   └─────────────┴──────────────────────────┘
 *
 * The sidebar can be collapsed to icon-only mode for smaller screens
 * or cashier workstations where screen space is limited.
 */
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  // Find the current page title for the header
  const currentPage = NAV_ITEMS.find((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
  );

  return (
    <div className={`${styles.layout} ${collapsed ? styles.collapsed : ''}`}>
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <Store size={20} />
          </div>
          {!collapsed && (
            <div className={styles.brandText}>
              <span className={styles.brandName}>Talaat Market</span>
              <span className={styles.brandSub}>تلعت ماركت</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={styles.nav} aria-label="Main navigation">
          <ul className={styles.navList}>
            {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  className={({ isActive }) =>
                    `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                  }
                  end={path === '/'}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={18} className={styles.navIcon} strokeWidth={1.75} />
                  {!collapsed && <span className={styles.navLabel}>{label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Collapse toggle */}
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Version */}
        {!collapsed && (
          <div className={styles.version}>
            <span>v1.0.0</span>
          </div>
        )}
      </aside>

      {/* ── Main Area ────────────────────────────────────────────── */}
      <div className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.menuBtn} aria-label="Toggle menu">
              <Menu size={20} />
            </button>
            <h1 className={styles.pageTitle}>{currentPage?.label ?? 'Talaat Market'}</h1>
          </div>

          <div className={styles.headerRight}>
            {/* Notifications placeholder */}
            <button className={styles.headerBtn} aria-label="Notifications">
              <Bell size={18} />
              <span className={styles.notifBadge}>3</span>
            </button>

            {/* User info placeholder */}
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>A</div>
              <div className={styles.userMeta}>
                <span className={styles.userName}>Admin</span>
                <span className={styles.userRole}>Administrator</span>
              </div>
            </div>

            {/* Logout placeholder */}
            <button className={styles.headerBtn} aria-label="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Content — child routes are rendered here via React Router Outlet */}
        <main className={styles.content} id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
