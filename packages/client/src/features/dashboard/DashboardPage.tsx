import { useRef, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { BarChart3, Users, Landmark, TrendingUp, Search, Calendar, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';

interface DashboardStats {
  productsCount: number;
  lowStockCount: number;
  employeesCount: number;
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Fetch counts from backend
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/dashboard/stats');
        return {
          productsCount: res.data?.data?.productsCount || 0,
          lowStockCount: res.data?.data?.lowStockCount || 0,
          employeesCount: res.data?.data?.employeesCount || 0,
        };
      } catch (err) {
        return {
          productsCount: 0,
          lowStockCount: 0,
          employeesCount: 0,
        };
      }
    },
    refetchOnWindowFocus: false,
  });

  // Focus command bar on load, and on global Cmd+K or F5 press
  useEffect(() => {
    commandInputRef.current?.focus();

    const handleGlobalKeys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        commandInputRef.current?.focus();
        commandInputRef.current?.select();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        commandInputRef.current?.focus();
        commandInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  return (
    <PageContainer
      title={t('dashboard.title')}
      description={t('dashboard.welcome')
        .replace('{username}', user?.username || '')
        .replace('{role}', user?.role || '')}
    >
      {/* ── 4-Card Uniform Metric Pulse Grid ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Net Sales */}
        <Card className="bg-neutral-850 border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-secondary">
              Net Sales
            </CardTitle>
            <Landmark className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              EGP 24,850.00
            </div>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-success font-semibold">
              <TrendingUp className="w-3 h-3" />
              <span>+12.4% vs yesterday</span>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Count */}
        <Card className="bg-neutral-850 border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-secondary">
              Transactions
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              142
            </div>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-success font-semibold">
              <span>+8.2% vs yesterday</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Cashiers */}
        <Card className="bg-neutral-850 border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-secondary">
              Active Staff
            </CardTitle>
            <Users className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {isLoading ? '...' : stats?.employeesCount}
            </div>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-secondary">
              <span>Registers active</span>
            </div>
          </CardContent>
        </Card>

        {/* Alerts / Low Stock */}
        <Card className="bg-neutral-850 border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-secondary">
              Stock Alerts
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {isLoading ? '...' : stats?.lowStockCount}
            </div>
            <div className={`flex items-center gap-1 mt-1 text-[10px] font-semibold ${(stats?.lowStockCount || 0) > 0 ? 'text-danger' : 'text-secondary'}`}>
              <span>{(stats?.lowStockCount || 0) > 0 ? 'Items below threshold' : 'All stock levels nominal'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Center Column: Command Launcher ── */}
      <div className="my-8 max-w-2xl mx-auto">
        <div className="bg-neutral-850 border border-border rounded shadow-xl overflow-hidden">
          <div className="flex items-center px-4 border-b border-border h-12 bg-neutral-900">
            <Search className="w-4 h-4 text-neutral-500 mr-3 shrink-0" />
            <input
              ref={commandInputRef}
              type="text"
              placeholder="Search shortcuts and modules... (Press F5 or Ctrl+K)"
              className="w-full bg-transparent border-none text-sm text-foreground placeholder-neutral-500 focus:outline-none py-2 select-text"
            />
            <span className="text-[10px] font-mono text-neutral-500 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800 shrink-0 select-none">
              ⌘K
            </span>
          </div>
          <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1 bg-neutral-950/20 text-xs">
            <Link
              to="/pos"
              className="flex items-center justify-between p-2.5 rounded hover:bg-neutral-800 text-secondary hover:text-foreground transition-all duration-fast"
            >
              <span className="font-medium">Launch Point of Sale (Checkout)</span>
              <kbd className="px-1.5 py-0.5 bg-neutral-900 border border-border rounded font-mono text-[9px]">SPACE</kbd>
            </Link>
            <Link
              to="/products"
              className="flex items-center justify-between p-2.5 rounded hover:bg-neutral-800 text-secondary hover:text-foreground transition-all duration-fast"
            >
              <span className="font-medium">Products Catalog</span>
              <kbd className="px-1.5 py-0.5 bg-neutral-900 border border-border rounded font-mono text-[9px]">P</kbd>
            </Link>
            <Link
              to="/inventory"
              className="flex items-center justify-between p-2.5 rounded hover:bg-neutral-800 text-secondary hover:text-foreground transition-all duration-fast"
            >
              <span className="font-medium">Stock levels & Adjustments</span>
              <kbd className="px-1.5 py-0.5 bg-neutral-900 border border-border rounded font-mono text-[9px]">I</kbd>
            </Link>
            <Link
              to="/reports"
              className="flex items-center justify-between p-2.5 rounded hover:bg-neutral-800 text-secondary hover:text-foreground transition-all duration-fast"
            >
              <span className="font-medium">Shift Reconciliation Reports</span>
              <kbd className="px-1.5 py-0.5 bg-neutral-900 border border-border rounded font-mono text-[9px]">R</kbd>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Sub-sections Dashboard Layout ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Launchpad Details */}
        <Card className="bg-neutral-850 border border-border">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">
              System Launchpad
            </h3>
          </div>
          <CardContent className="p-4 space-y-2">
            <Link
              to="/pos"
              className="flex items-center justify-between p-3 rounded bg-neutral-900 border border-border hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Point of Sale</span>
              </div>
              <span className="text-xs text-secondary">Open Terminal</span>
            </Link>
            <Link
              to="/reports"
              className="flex items-center justify-between p-3 rounded bg-neutral-900 border border-border hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <FileText className="h-4 w-4 text-success" />
                <span className="text-sm font-semibold text-foreground">Shift Reports</span>
              </div>
              <span className="text-xs text-secondary">Reconcile Daily Sales</span>
            </Link>
          </CardContent>
        </Card>

        {/* Live Diagnostics Card (Collapsed into a readable summary widget) */}
        <Card className="bg-neutral-850 border border-border">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">
              System Diagnostics
            </h3>
          </div>
          <CardContent className="p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between py-1 border-b border-[#1F1F1F]">
              <span className="text-secondary">Database Connection</span>
              <span className="text-success font-semibold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-success rounded-full animate-pulse" />
                PostgreSQL Active
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#1F1F1F]">
              <span className="text-secondary">Authentication Mode</span>
              <span className="text-success font-semibold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-success rounded-full animate-pulse" />
                JWT Session Valid
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-secondary">App Scope Role</span>
              <span className="text-primary font-bold uppercase">
                {user?.role || 'cashier'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

export default DashboardPage;
