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
        <Card className="border border-border border-t-[3px] border-t-primary hover:border-primary/50 transition-colors duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-secondary">
              {t('dashboard.netSalesToday') || 'Net Sales — Today'}
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <KpiSkeleton />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
                  EGP {stats!.todayNetSales.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-secondary font-medium">
                  <span className="text-primary font-bold">{stats!.todayTransactionCount}</span> <span>{stats!.todayTransactionCount === 1 ? 'transaction' : 'transactions'} completed</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Today Transactions */}
        <Card className="border border-border border-t-[3px] border-t-success hover:border-success/50 transition-colors duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-secondary">
              {t('dashboard.transactionsToday') || 'Transactions — Today'}
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <KpiSkeleton />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
                  {stats!.todayTransactionCount.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-secondary font-medium">
                  <span className="text-success font-bold">Sales</span> <span>processed today</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Active Shifts */}
        <Card className="border border-border border-t-[3px] border-t-[#3B82F6] hover:border-blue-400/50 transition-colors duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-secondary">
              {t('dashboard.activeShifts') || 'Active Shifts'}
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <KpiSkeleton />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
                  {stats!.employeesCount.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-secondary font-medium">
                  <span className="text-blue-600 font-bold">Open</span> <span>registers</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card className={`border transition-colors duration-200 ${stats?.lowStockCount ? 'border-danger/50 bg-danger/5 border-t-[3px] border-t-danger hover:border-danger/50' : 'border-border border-t-[3px] border-t-danger hover:border-danger/50'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-secondary">
              {t('dashboard.stockAlerts') || 'Stock Alerts'}
            </CardTitle>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${stats?.lowStockCount ? 'bg-danger/10 animate-pulse' : 'bg-warning/10'}`}>
              <BarChart3 className={`h-4 w-4 ${stats?.lowStockCount ? 'text-danger' : 'text-warning'}`} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <KpiSkeleton />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
                  {stats!.lowStockCount.toLocaleString()}
                </div>
                <div
                  className={`flex items-center gap-1 mt-1 text-xs font-semibold ${
                    stats!.lowStockCount > 0 ? 'text-danger' : 'text-secondary'
                  }`}
                >
                  {stats!.lowStockCount > 0 ? (
                    <>
                      <AlertTriangle className="w-3 h-3" />
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

      {/* ── Operational Overview ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-4 mb-2">
        
        {/* Today's Activity */}
        <Card className="border border-border">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-bold text-foreground">
                Today's Activity
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="space-y-3">
                <KpiSkeleton />
                <KpiSkeleton />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
                <div>
                  <div className="text-sm font-medium text-secondary">Sales Today</div>
                  <div className="text-lg font-bold font-mono text-primary">EGP {stats!.todayNetSales.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-secondary">Transactions</div>
                  <div className="text-lg font-bold font-mono text-foreground">{stats!.todayTransactionCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-secondary">Active Cashiers</div>
                  <div className="text-lg font-bold font-mono text-foreground">{stats!.employeesCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-secondary">Refunds</div>
                  <div className="text-lg font-bold font-mono text-foreground">{stats!.todayRefundsCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-secondary">Voids</div>
                  <div className="text-lg font-bold font-mono text-foreground">{stats!.todayVoidsCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-secondary">Drawer Adjs.</div>
                  <div className="text-lg font-bold font-mono text-foreground">{stats!.todayDrawerAdjustmentsCount.toLocaleString()}</div>
                </div>
              </div>
            )}
            {!isLoading && stats!.todayTransactionCount === 0 && stats!.employeesCount === 0 && (
              <div className="mt-4 text-sm text-secondary italic">
                No activity recorded today
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts & Exceptions */}
        <Card className="border border-border flex flex-col">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 text-warning" />
              <CardTitle className="text-base font-bold text-foreground">
                Alerts &amp; Exceptions
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                <KpiSkeleton />
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Check if empty */}
                {stats!.negativeInventoryCount === 0 &&
                 stats!.unreconciledShiftsCount === 0 &&
                 stats!.lowStockCount === 0 &&
                 stats!.pendingPurchaseOrdersCount === 0 &&
                 stats!.failedPrintJobsCount === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 py-12 px-4 text-center bg-success/5 m-4 rounded-lg border border-success/20">
                    <CheckCircle2 className="h-10 w-10 text-success mb-3" />
                    <h3 className="text-success font-bold text-lg">All systems operating normally</h3>
                    <p className="text-success/80 text-sm mt-1">No operational issues detected.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {/* CRITICAL */}
                    {stats!.negativeInventoryCount > 0 && (
                      <Link to="/inventory" className="flex items-center justify-between p-4 hover:bg-danger/5 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-danger/10 flex items-center justify-center shrink-0">
                            <AlertOctagon className="h-4 w-4 text-danger" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground group-hover:text-danger transition-colors">Negative Inventory</div>
                            <div className="text-xs text-secondary mt-0.5">{stats!.negativeInventoryCount} products require correction</div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-secondary group-hover:text-danger group-hover:translate-x-1 transition-all" />
                      </Link>
                    )}
                    {stats!.unreconciledShiftsCount > 0 && (
                      <Link to="/reports/shifts" className="flex items-center justify-between p-4 hover:bg-danger/5 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-danger/10 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-danger" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground group-hover:text-danger transition-colors">Unreconciled Shifts</div>
                            <div className="text-xs text-secondary mt-0.5">{stats!.unreconciledShiftsCount} shifts pending review</div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-secondary group-hover:text-danger group-hover:translate-x-1 transition-all" />
                      </Link>
                    )}

                    {/* WARNINGS */}
                    {stats!.lowStockCount > 0 && (
                      <Link to="/inventory" className="flex items-center justify-between p-4 hover:bg-warning/5 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-warning" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground group-hover:text-warning transition-colors">Low Stock Products</div>
                            <div className="text-xs text-secondary mt-0.5">{stats!.lowStockCount} items below threshold</div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-secondary group-hover:text-warning group-hover:translate-x-1 transition-all" />
                      </Link>
                    )}
                    {stats!.pendingPurchaseOrdersCount > 0 && (
                      <Link to="/purchases" className="flex items-center justify-between p-4 hover:bg-warning/5 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                            <Clock className="h-4 w-4 text-warning" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground group-hover:text-warning transition-colors">Pending Purchase Orders</div>
                            <div className="text-xs text-secondary mt-0.5">{stats!.pendingPurchaseOrdersCount} active orders</div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-secondary group-hover:text-warning group-hover:translate-x-1 transition-all" />
                      </Link>
                    )}
                    {stats!.failedPrintJobsCount > 0 && (
                      <Link to="/pos?modal=transaction_search" className="flex items-center justify-between p-4 hover:bg-warning/5 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                            <Printer className="h-4 w-4 text-warning" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground group-hover:text-warning transition-colors">Pending Print Jobs</div>
                            <div className="text-xs text-secondary mt-0.5">{stats!.failedPrintJobsCount} receipts queued/failed</div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-secondary group-hover:text-warning group-hover:translate-x-1 transition-all" />
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-2">
        <Link
          to="/pos"
          className="flex items-center gap-3 p-4 rounded bg-white border border-border hover:bg-primary-50 hover:border-primary hover:shadow-md hover:-translate-y-0.5 transition-all group"
        >
          <div className="h-9 w-9 rounded flex items-center justify-center bg-primary/10 border border-primary/20 text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
            <ShoppingCart size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {t('nav.pos') || 'Point of Sale'}
            </div>
            <div className="text-xs text-secondary mt-0.5">Open terminal</div>
          </div>
        </Link>

        <Link
          to="/reports"
          className="flex items-center gap-3 p-4 rounded bg-white border border-border hover:bg-success-50 hover:border-success hover:shadow-md hover:-translate-y-0.5 transition-all group"
        >
          <div className="h-9 w-9 rounded flex items-center justify-center bg-success/10 border border-success/20 text-success shrink-0 group-hover:bg-success group-hover:text-white transition-colors">
            <FileText size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground group-hover:text-success transition-colors">
              {t('nav.reports') || 'Reports'}
            </div>
            <div className="text-xs text-secondary mt-0.5">Shift reconciliation</div>
          </div>
        </Link>

        <Link
          to="/inventory"
          className="flex items-center gap-3 p-4 rounded bg-white border border-border hover:bg-warning-50 hover:border-warning hover:shadow-md hover:-translate-y-0.5 transition-all group"
        >
          <div className="h-9 w-9 rounded flex items-center justify-center bg-warning/10 border border-warning/20 text-warning shrink-0 group-hover:bg-warning group-hover:text-white transition-colors">
            <Package size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground group-hover:text-warning transition-colors">
              {t('nav.inventory') || 'Inventory'}
            </div>
            <div className="text-xs text-secondary mt-0.5">Stock levels &amp; adjustments</div>
          </div>
        </Link>

        <Link
          to="/products"
          className="flex items-center gap-3 p-4 rounded bg-white border border-border hover:bg-neutral-50 hover:border-neutral-500 hover:shadow-md hover:-translate-y-0.5 transition-all group"
        >
          <div className="h-9 w-9 rounded flex items-center justify-center bg-neutral-700/40 border border-neutral-700 text-secondary shrink-0 group-hover:bg-neutral-700 group-hover:text-white transition-colors">
            <BarChart3 size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground transition-colors">
              {t('nav.products') || 'Products'}
            </div>
            <div className="text-xs text-secondary mt-0.5">Catalog &amp; pricing</div>
          </div>
        </Link>
      </div>
    </PageContainer>
  );
}

export default DashboardPage;
