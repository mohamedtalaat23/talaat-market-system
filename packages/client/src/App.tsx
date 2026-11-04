import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { useAuthStore } from '@/stores/authStore';
import { LANSyncManager } from '@/features/pos/components/LANSyncManager';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { PreferencesProvider } from '@/contexts/preferencesContext';
const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const ChangePasswordPage = lazy(() =>
  import('@/features/auth/ChangePasswordPage').then((module) => ({
    default: module.ChangePasswordPage,
  })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);
const ProductsPage = lazy(() =>
  import('@/features/products/ProductsPage').then((module) => ({ default: module.ProductsPage })),
);
const InventoryPage = lazy(() =>
  import('@/features/inventory/InventoryPage').then((module) => ({
    default: module.InventoryPage,
  })),
);
const EmployeesPage = lazy(() =>
  import('@/features/employees/EmployeesPage').then((module) => ({
    default: module.EmployeesPage,
  })),
);
const POSPage = lazy(() =>
  import('@/features/pos/POSPage').then((module) => ({ default: module.POSPage })),
);
const ReportsLayout = lazy(() =>
  import('@/features/reports/ReportsLayout').then((module) => ({ default: module.ReportsLayout })),
);
const ShiftReconciliationScreen = lazy(() =>
  import('@/features/reports/screens/ShiftReconciliationScreen').then((module) => ({
    default: module.ShiftReconciliationScreen,
  })),
);
const ShiftDetailScreen = lazy(() =>
  import('@/features/reports/screens/ShiftDetailScreen').then((module) => ({
    default: module.ShiftDetailScreen,
  })),
);
const WeeklyReportScreen = lazy(() =>
  import('@/features/reports/screens/WeeklyReportScreen').then((module) => ({
    default: module.WeeklyReportScreen,
  })),
);
const OverrideAuditScreen = lazy(() =>
  import('@/features/reports/screens/OverrideAuditScreen').then((module) => ({
    default: module.OverrideAuditScreen,
  })),
);
import { Spinner } from '@/components/ui/Spinner';
const SettingsLayout = lazy(() =>
  import('@/features/settings/SettingsLayout').then((module) => ({
    default: module.SettingsLayout,
  })),
);
const GeneralSettingsScreen = lazy(() =>
  import('@/features/settings/screens/GeneralSettingsScreen').then((module) => ({
    default: module.GeneralSettingsScreen,
  })),
);
const POSPreferencesScreen = lazy(() =>
  import('@/features/settings/screens/POSPreferencesScreen').then((module) => ({
    default: module.POSPreferencesScreen,
  })),
);
const ReceiptSettingsScreen = lazy(() =>
  import('@/features/settings/screens/ReceiptSettingsScreen').then((module) => ({
    default: module.ReceiptSettingsScreen,
  })),
);
const RegistersScreen = lazy(() =>
  import('@/features/settings/screens/RegistersScreen').then((module) => ({
    default: module.RegistersScreen,
  })),
);
const PrinterSettingsScreen = lazy(() =>
  import('@/features/settings/screens/PrinterSettingsScreen').then((module) => ({
    default: module.PrinterSettingsScreen,
  })),
);
const LANSettingsScreen = lazy(() =>
  import('@/features/settings/screens/LANSettingsScreen').then((module) => ({
    default: module.LANSettingsScreen,
  })),
);
const CustomersPage = lazy(() =>
  import('@/features/customers/CustomersPage').then((module) => ({
    default: module.CustomersPage,
  })),
);
const CustomerDetailScreen = lazy(() =>
  import('@/features/customers/screens/CustomerDetailScreen').then((module) => ({
    default: module.CustomerDetailScreen,
  })),
);
const SuppliersPage = lazy(() =>
  import('@/features/suppliers/SuppliersPage').then((module) => ({
    default: module.SuppliersPage,
  })),
);
const SupplierDetailScreen = lazy(() =>
  import('@/features/suppliers/screens/SupplierDetailScreen').then((module) => ({
    default: module.SupplierDetailScreen,
  })),
);
const PurchasesPage = lazy(() =>
  import('@/features/purchases/PurchasesPage').then((module) => ({
    default: module.PurchasesPage,
  })),
);
const PurchaseOrderDetailScreen = lazy(() =>
  import('@/features/purchases/PurchaseOrderDetailScreen').then((module) => ({
    default: module.PurchaseOrderDetailScreen,
  })),
);

/**
 * TanStack Query client configuration.
 *
 * - staleTime: 30s — data is considered fresh for 30 seconds before background refetch
 * - retry: 1 — retry failed requests once before showing an error
 * - refetchOnWindowFocus: false — don't refetch when the Electron window gains focus
 */
const OperationsScreen = lazy(() =>
  import('@/features/settings/screens/OperationsScreen').then((module) => ({
    default: module.OperationsScreen,
  })),
);

const ApplicationRouter = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Layout route wrapper — renders AppLayout with an Outlet for child routes.
 */
function AppLayoutRoute() {
  return <AppLayout />;
}

/**
 * App root component.
 *
 * Configures the router, TanStack Query, Error Boundaries,
 * and handles session validation on application startup.
 */
export function App() {
  const { initializeAuth, isLoading } = useAuthStore();

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-neutral-950 text-foreground">
        <Spinner size="lg" />
        <span className="mt-4 text-sm text-neutral-400 font-mono">
          Loading Talaat Market System...
        </span>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <ErrorBoundary>
          <ApplicationRouter>
            <Suspense
              fallback={
                <div className="flex justify-center p-12">
                  <Spinner />
                </div>
              }
            >
              <Routes>
                {/* Public route */}
                <Route path="login" element={<LoginPage />} />

                {/* Forced password rotation (provisioned/temporary credentials) */}
                <Route
                  path="change-password"
                  element={
                    <ProtectedRoute>
                      <ChangePasswordPage />
                    </ProtectedRoute>
                  }
                />

                {/* Point of Sale (POS) - Cashier, Manager, Admin allowed - Full screen shell */}
                <Route
                  path="pos"
                  element={
                    <ProtectedRoute>
                      <POSPage />
                    </ProtectedRoute>
                  }
                />

                {/* Authenticated layout shell */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayoutRoute />
                    </ProtectedRoute>
                  }
                >
                  {/* Dashboard */}
                  <Route index element={<DashboardPage />} />

                  {/* Products Catalog - Managers and Admin allowed */}
                  <Route
                    path="products/*"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'manager']}>
                        <ProductsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Inventory Management - Managers and Admin allowed */}
                  <Route
                    path="inventory/*"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'manager']}>
                        <InventoryPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Employees - Admin allowed only */}
                  <Route
                    path="employees/*"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <EmployeesPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Other Features - simple placeholders for now */}
                  <Route
                    path="suppliers"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'manager']}>
                        <SuppliersPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="suppliers/:id"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'manager']}>
                        <SupplierDetailScreen />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="purchases"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'manager']}>
                        <PurchasesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="purchases/:id"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'manager']}>
                        <PurchaseOrderDetailScreen />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="customers" element={<CustomersPage />} />
                  <Route path="customers/:id" element={<CustomerDetailScreen />} />
                  <Route
                    path="reports"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'manager']}>
                        <ReportsLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="shifts" replace />} />
                    <Route path="shifts" element={<ShiftReconciliationScreen />} />
                    <Route path="shifts/:id" element={<ShiftDetailScreen />} />
                    <Route path="weekly" element={<WeeklyReportScreen />} />
                    <Route path="overrides" element={<OverrideAuditScreen />} />
                  </Route>
                  <Route
                    path="settings"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <SettingsLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="general" replace />} />
                    <Route path="operations" element={<OperationsScreen />} />
                    <Route path="general" element={<GeneralSettingsScreen />} />
                    <Route path="pos" element={<POSPreferencesScreen />} />
                    <Route path="receipts" element={<ReceiptSettingsScreen />} />
                    <Route path="registers" element={<RegistersScreen />} />
                    <Route path="printers" element={<PrinterSettingsScreen />} />
                    <Route path="lan" element={<LANSettingsScreen />} />
                  </Route>

                  {/* 404 fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </ApplicationRouter>
          <LANSyncManager />
        </ErrorBoundary>
      </PreferencesProvider>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#171717',
            color: '#f5f5f5',
            border: '1px solid #262626',
            borderRadius: '8px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#171717' },
          },
          error: {
            iconTheme: { primary: '#f43f5e', secondary: '#171717' },
          },
        }}
      />
    </QueryClientProvider>
  );
}
export default App;
