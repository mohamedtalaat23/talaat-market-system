import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import {
  BarChart3,
  Users,
  Landmark,
  TrendingUp,
  ShoppingCart,
  FileText,
  Package,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Printer,
  Activity,
  AlertOctagon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { ReturnApprovalDashboard } from './components/ReturnApprovalDashboard';

interface DashboardStats {
  productsCount: number;
  lowStockCount: number;
  employeesCount: number;
  todayNetSales: number;
  todayTransactionCount: number;
  todayRefundsCount: number;
  todayVoidsCount: number;
  todayDrawerAdjustmentsCount: number;
  pendingPurchaseOrdersCount: number;
  unreconciledShiftsCount: number;
  failedPrintJobsCount: number;
  negativeInventoryCount: number;
}

/** Skeleton block for a single KPI card value */
function KpiSkeleton() {
  return (
    <div className="space-y-2 mt-1">
      <div className="h-7 w-28 rounded bg-neutral-200 animate-pulse" />
      <div className="h-3.5 w-20 rounded bg-neutral-100 animate-pulse" />
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/stats');
      return {
        productsCount: res.data?.data?.productsCount ?? 0,
        lowStockCount: res.data?.data?.lowStockCount ?? 0,
        employeesCount: res.data?.data?.employeesCount ?? 0,
        todayNetSales: res.data?.data?.todayNetSales ?? 0,
        todayTransactionCount: res.data?.data?.todayTransactionCount ?? 0,
        todayRefundsCount: res.data?.data?.todayRefundsCount ?? 0,
        todayVoidsCount: res.data?.data?.todayVoidsCount ?? 0,
        todayDrawerAdjustmentsCount: res.data?.data?.todayDrawerAdjustmentsCount ?? 0,
        pendingPurchaseOrdersCount: res.data?.data?.pendingPurchaseOrdersCount ?? 0,
        unreconciledShiftsCount: res.data?.data?.unreconciledShiftsCount ?? 0,
        failedPrintJobsCount: res.data?.data?.failedPrintJobsCount ?? 0,
        negativeInventoryCount: res.data?.data?.negativeInventoryCount ?? 0,
      };
    },
    refetchOnWindowFocus: false,
    staleTime: 60_000, // Refresh at most every 60 seconds
  });

  return (
    <PageContainer
      title={t('dashboard.title')}
      description={`${t('dashboard.welcome').replace('{username}', user?.full_name || user?.username || '').replace('{role}', user?.role || '')}`}
    >
      {/* ── 4-Card KPI Grid ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">

        {/* Today Net Sales */}
        <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-secondary group-hover:text-primary transition-colors">
              {t('dashboard.netSalesToday') || 'Net Sales — Today'}
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <KpiSkeleton />
            ) : (
              <>
                <div className="text-3xl font-black font-mono tracking-tight text-foreground drop-shadow-sm group-hover:text-primary transition-colors">
                  EGP {stats!.todayNetSales.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="flex items-center gap-1 mt-2 text-[11px] text-secondary font-bold uppercase tracking-wide">
                  <span className="text-primary">{stats!.todayTransactionCount}</span> <span>{stats!.todayTransactionCount === 1 ? 'transaction' : 'transactions'}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Today Transactions */}
        <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-secondary group-hover:text-success transition-colors">
              {t('dashboard.transactionsToday') || 'Transactions — Today'}
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-success/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <KpiSkeleton />
            ) : (
              <>
                <div className="text-3xl font-black font-mono tracking-tight text-foreground drop-shadow-sm group-hover:text-success transition-colors">
                  {stats!.todayTransactionCount.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 mt-2 text-[11px] text-secondary font-bold uppercase tracking-wide">
                  <span className="text-success">Sales</span> <span>processed</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Active Shifts */}
        <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-secondary group-hover:text-blue-500 transition-colors">
              {t('dashboard.activeShifts') || 'Active Shifts'}
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <KpiSkeleton />
            ) : (
              <>
                <div className="text-3xl font-black font-mono tracking-tight text-foreground drop-shadow-sm group-hover:text-blue-500 transition-colors">
                  {stats!.employeesCount.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 mt-2 text-[11px] text-secondary font-bold uppercase tracking-wide">
                  <span className="text-blue-500">Open</span> <span>registers</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card className={`border shadow-sm rounded-2xl overflow-hidden transition-all duration-300 group hover:-translate-y-1 hover:shadow-md ${stats?.lowStockCount ? 'border-danger/30 bg-danger/5 hover:border-danger/60' : 'border-border/60 bg-card hover:border-border'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-secondary group-hover:text-danger transition-colors">
              {t('dashboard.stockAlerts') || 'Stock Alerts'}
            </CardTitle>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${stats?.lowStockCount ? 'bg-danger/10 animate-pulse' : 'bg-warning/10'}`}>
              <BarChart3 className={`h-4 w-4 ${stats?.lowStockCount ? 'text-danger' : 'text-warning'}`} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <KpiSkeleton />
            ) : (
              <>
                <div className={`text-3xl font-black font-mono tracking-tight drop-shadow-sm transition-colors ${stats!.lowStockCount > 0 ? 'text-danger group-hover:text-danger' : 'text-foreground group-hover:text-warning'}`}>
                  {stats!.lowStockCount.toLocaleString()}
                </div>
                <div
                  className={`flex items-center gap-1 mt-2 text-[11px] font-bold uppercase tracking-wide ${
                    stats!.lowStockCount > 0 ? 'text-danger' : 'text-secondary'
                  }`}
                >
                  {stats!.lowStockCount > 0 ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Items below threshold</span>
                    </>
                  ) : (
                    <span>All stock levels nominal</span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ReturnApprovalDashboard />

      {/* ── Operational Overview ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-4 mb-2">
        
        {/* Today's Activity */}
        {/* Today's Activity */}
        <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card transition-all duration-300 hover:shadow-md">
          <CardHeader className="pb-4 border-b border-border/40 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl font-black tracking-tight text-foreground drop-shadow-sm">
                Today's Activity
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-3">
                <KpiSkeleton />
                <KpiSkeleton />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-background border border-border/60 rounded-xl p-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-1 hover:shadow-md duration-300 group">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2 group-hover:text-primary transition-colors">Sales Today</div>
                  <div className="text-2xl font-black font-mono tabular-nums tracking-tight text-primary drop-shadow-sm">EGP {stats!.todayNetSales.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-background border border-border/60 rounded-xl p-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-1 hover:shadow-md duration-300 group">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2 group-hover:text-success transition-colors">Transactions</div>
                  <div className="text-2xl font-black font-mono tabular-nums tracking-tight text-success">{stats!.todayTransactionCount.toLocaleString()}</div>
                </div>
                <div className="bg-background border border-border/60 rounded-xl p-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-1 hover:shadow-md duration-300 group">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2 group-hover:text-blue-500 transition-colors">Active Cashiers</div>
                  <div className="text-2xl font-black font-mono tabular-nums tracking-tight text-blue-500">{stats!.employeesCount.toLocaleString()}</div>
                </div>
                <div className="bg-background border border-border/60 rounded-xl p-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-1 hover:shadow-md duration-300 group">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2 group-hover:text-danger transition-colors">Refunds</div>
                  <div className="text-2xl font-black font-mono tabular-nums tracking-tight text-danger">{stats!.todayRefundsCount.toLocaleString()}</div>
                </div>
                <div className="bg-background border border-border/60 rounded-xl p-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-1 hover:shadow-md duration-300 group">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2 group-hover:text-warning transition-colors">Voids</div>
                  <div className="text-2xl font-black font-mono tabular-nums tracking-tight text-warning">{stats!.todayVoidsCount.toLocaleString()}</div>
                </div>
                <div className="bg-background border border-border/60 rounded-xl p-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-1 hover:shadow-md duration-300 group">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2 group-hover:text-purple-500 transition-colors">Drawer Adjs.</div>
                  <div className="text-2xl font-black font-mono tabular-nums tracking-tight text-purple-500">{stats!.todayDrawerAdjustmentsCount.toLocaleString()}</div>
                </div>
              </div>
            )}
            {!isLoading && stats!.todayTransactionCount === 0 && stats!.employeesCount === 0 && (
              <div className="mt-6 p-4 rounded-xl bg-secondary/5 border border-secondary/10 flex items-center justify-center">
                <span className="text-sm font-semibold tracking-wide text-secondary uppercase">
                  No activity recorded today
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts & Exceptions */}
        <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card flex flex-col transition-all duration-300 hover:shadow-md">
          <CardHeader className="pb-4 border-b border-border/40 bg-gradient-to-r from-warning/5 via-transparent to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-xl">
                <AlertOctagon className="h-6 w-6 text-warning" />
              </div>
              <CardTitle className="text-xl font-black tracking-tight text-foreground drop-shadow-sm">
                Alerts &amp; Exceptions
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                <KpiSkeleton />
              </div>
            ) : (
              <div className="flex flex-col h-full bg-card">
                {/* Check if empty */}
                {stats!.negativeInventoryCount === 0 &&
                 stats!.unreconciledShiftsCount === 0 &&
                 stats!.lowStockCount === 0 &&
                 stats!.pendingPurchaseOrdersCount === 0 &&
                 stats!.failedPrintJobsCount === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 py-12 px-4 text-center bg-success/5 m-6 rounded-2xl border border-success/20">
                    <div className="p-3 bg-success/10 rounded-full mb-4">
                      <CheckCircle2 className="h-10 w-10 text-success" />
                    </div>
                    <h3 className="text-success font-black tracking-tight text-lg drop-shadow-sm">All systems nominal</h3>
                    <p className="text-success/80 text-sm mt-1 font-semibold">No operational issues detected.</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {/* CRITICAL */}
                    {stats!.negativeInventoryCount > 0 && (
                      <Link to="/inventory" className="flex items-center justify-between p-4 rounded-xl bg-background border border-border/40 hover:border-danger/30 hover:bg-danger/5 hover:shadow-md transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-danger/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <AlertOctagon className="h-5 w-5 text-danger" />
                          </div>
                          <div>
                            <div className="text-sm font-black tracking-tight text-foreground group-hover:text-danger transition-colors">Negative Inventory</div>
                            <div className="text-xs font-semibold text-secondary mt-0.5">{stats!.negativeInventoryCount} products require correction</div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-border group-hover:text-danger group-hover:translate-x-1 transition-all" />
                      </Link>
                    )}
                    {stats!.unreconciledShiftsCount > 0 && (
                      <Link to="/reports/shifts" className="flex items-center justify-between p-4 rounded-xl bg-background border border-border/40 hover:border-danger/30 hover:bg-danger/5 hover:shadow-md transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-danger/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <Users className="h-5 w-5 text-danger" />
                          </div>
                          <div>
                            <div className="text-sm font-black tracking-tight text-foreground group-hover:text-danger transition-colors">Unreconciled Shifts</div>
                            <div className="text-xs font-semibold text-secondary mt-0.5">{stats!.unreconciledShiftsCount} shifts pending review</div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-border group-hover:text-danger group-hover:translate-x-1 transition-all" />
                      </Link>
                    )}

                    {/* WARNINGS */}
                    {stats!.lowStockCount > 0 && (
                      <Link to="/inventory" className="flex items-center justify-between p-4 rounded-xl bg-background border border-border/40 hover:border-warning/30 hover:bg-warning/5 hover:shadow-md transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <Package className="h-5 w-5 text-warning" />
                          </div>
                          <div>
                            <div className="text-sm font-black tracking-tight text-foreground group-hover:text-warning transition-colors">Low Stock Products</div>
                            <div className="text-xs font-semibold text-secondary mt-0.5">{stats!.lowStockCount} items below threshold</div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-border group-hover:text-warning group-hover:translate-x-1 transition-all" />
                      </Link>
                    )}
                    {stats!.pendingPurchaseOrdersCount > 0 && (
                      <Link to="/purchases" className="flex items-center justify-between p-4 rounded-xl bg-background border border-border/40 hover:border-warning/30 hover:bg-warning/5 hover:shadow-md transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <Clock className="h-5 w-5 text-warning" />
                          </div>
                          <div>
                            <div className="text-sm font-black tracking-tight text-foreground group-hover:text-warning transition-colors">Pending Purchase Orders</div>
                            <div className="text-xs font-semibold text-secondary mt-0.5">{stats!.pendingPurchaseOrdersCount} active orders</div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-border group-hover:text-warning group-hover:translate-x-1 transition-all" />
                      </Link>
                    )}
                    {stats!.failedPrintJobsCount > 0 && (
                      <Link to="/pos?modal=transaction_search" className="flex items-center justify-between p-4 rounded-xl bg-background border border-border/40 hover:border-warning/30 hover:bg-warning/5 hover:shadow-md transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <Printer className="h-5 w-5 text-warning" />
                          </div>
                          <div>
                            <div className="text-sm font-black tracking-tight text-foreground group-hover:text-warning transition-colors">Pending Print Jobs</div>
                            <div className="text-xs font-semibold text-secondary mt-0.5">{stats!.failedPrintJobsCount} receipts queued/failed</div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-border group-hover:text-warning group-hover:translate-x-1 transition-all" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
        <Link
          to="/pos"
          className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-primary/50 transition-all duration-300 group"
        >
          <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20 text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors group-hover:scale-110">
            <ShoppingCart size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-base font-black tracking-tight text-foreground group-hover:text-primary transition-colors">
              {t('nav.pos') || 'Point of Sale'}
            </div>
            <div className="text-xs font-semibold text-secondary mt-0.5 uppercase tracking-wider">Open terminal</div>
          </div>
        </Link>

        <Link
          to="/reports"
          className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-success/50 transition-all duration-300 group"
        >
          <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-success/10 border border-success/20 text-success shrink-0 group-hover:bg-success group-hover:text-white transition-colors group-hover:scale-110">
            <FileText size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-base font-black tracking-tight text-foreground group-hover:text-success transition-colors">
              {t('nav.reports') || 'Reports'}
            </div>
            <div className="text-xs font-semibold text-secondary mt-0.5 uppercase tracking-wider">Shift reconciliation</div>
          </div>
        </Link>

        <Link
          to="/inventory"
          className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-warning/50 transition-all duration-300 group"
        >
          <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-warning/10 border border-warning/20 text-warning shrink-0 group-hover:bg-warning group-hover:text-white transition-colors group-hover:scale-110">
            <Package size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-base font-black tracking-tight text-foreground group-hover:text-warning transition-colors">
              {t('nav.inventory') || 'Inventory'}
            </div>
            <div className="text-xs font-semibold text-secondary mt-0.5 uppercase tracking-wider">Stock &amp; adjustments</div>
          </div>
        </Link>

        <Link
          to="/products"
          className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-neutral-500/50 transition-all duration-300 group"
        >
          <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-secondary/10 border border-secondary/20 text-secondary shrink-0 group-hover:bg-neutral-800 group-hover:text-white transition-colors group-hover:scale-110">
            <BarChart3 size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-base font-black tracking-tight text-foreground group-hover:text-neutral-800 dark:group-hover:text-white transition-colors">
              {t('nav.products') || 'Products'}
            </div>
            <div className="text-xs font-semibold text-secondary mt-0.5 uppercase tracking-wider">Catalog &amp; pricing</div>
          </div>
        </Link>
      </div>
    </PageContainer>
  );
}

export default DashboardPage;
