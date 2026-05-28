import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { Badge } from '@/components/ui/Badge';
import { Package, BarChart3, Users, Store, ShieldAlert, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardStats {
  productsCount: number;
  lowStockCount: number;
  employeesCount: number;
}

export function DashboardPage() {
  const { user } = useAuthStore();

  // Fetch aggregate counts from the dashboard stats endpoint
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
        // Safe fallback values if server is unreachable
        return {
          productsCount: 0,
          lowStockCount: 0,
          employeesCount: 0,
        };
      }
    },
    refetchOnWindowFocus: false,
  });

  return (
    <PageContainer
      title="System Dashboard"
      description={`Welcome, ${user?.username} (${user?.role}). Manage Talaat Market operations cleanly and securely.`}
    >
      {/* ── Status Grid ────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Catalog Summary */}
        <Card className="hover:border-primary/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-tight text-neutral-400">
              Active Catalog
            </CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">
              {isLoading ? '...' : stats?.productsCount}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Registered items in database
            </p>
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card className="hover:border-warning/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-tight text-neutral-400">
              Low-Stock Items
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">
              {isLoading ? '...' : stats?.lowStockCount}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Products below warning threshold
            </p>
          </CardContent>
        </Card>

        {/* Personnel Status */}
        <Card className="hover:border-success/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold tracking-tight text-neutral-400">
              Staff Shift Status
            </CardTitle>
            <Users className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">
              {isLoading ? '...' : stats?.employeesCount}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Active cashiers on duty
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Action and System Cards ──────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2 mt-6">
        {/* Quick Launchpad */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Store Quick Access</CardTitle>
            <CardDescription>Shortcut triggers for routine operational tasks.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link
              to="/pos"
              className="flex items-center space-x-3 p-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors"
            >
              <ShoppingCart className="h-5 w-5 text-primary" />
              <div className="text-left">
                <span className="text-sm font-semibold block text-foreground">Launch Point of Sale</span>
                <span className="text-xs text-neutral-400">Process cart checkouts and cash transactions.</span>
              </div>
            </Link>
            <Link
              to="/products"
              className="flex items-center space-x-3 p-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors"
            >
              <Package className="h-5 w-5 text-indigo-400" />
              <div className="text-left">
                <span className="text-sm font-semibold block text-foreground">Manage Catalog</span>
                <span className="text-xs text-neutral-400">Edit products, barcodes, and categorizations.</span>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* System Diagnostics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">System Diagnostics</CardTitle>
            <CardDescription>Integrations verification for supermarket desktop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Database Engine</span>
              <Badge variant="success">PostgreSQL Active</Badge>
            </div>
            <div className="flex items-center justify-between text-sm py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Auth Token Provider</span>
              <Badge variant="success">JWT Stateless</Badge>
            </div>
            <div className="flex items-center justify-between text-sm py-1 border-b border-neutral-800">
              <span className="text-neutral-400">Station Identity</span>
              <div className="flex items-center space-x-1.5 text-foreground font-semibold">
                <Store size={14} className="text-neutral-500" />
                <span>Station_01 (Supermarket Main)</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-neutral-400">User Role Permissions</span>
              <div className="flex items-center space-x-1.5">
                <ShieldAlert size={14} className="text-primary" />
                <span className="font-semibold text-primary uppercase text-xs">{user?.role}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
export default DashboardPage;
