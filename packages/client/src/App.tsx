import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { useAuthStore } from '@/stores/authStore';
import { LANSyncManager } from '@/features/pos/components/LANSyncManager';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { PlaceholderPage } from '@/components/ui/PlaceholderPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ProductsPage } from '@/features/products/ProductsPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { EmployeesPage } from '@/features/employees/EmployeesPage';
import { POSPage } from '@/features/pos/POSPage';
import { ReportsLayout } from '@/features/reports/ReportsLayout';
import { ShiftReconciliationScreen } from '@/features/reports/screens/ShiftReconciliationScreen';
import { ShiftDetailScreen } from '@/features/reports/screens/ShiftDetailScreen';
import { WeeklyReportScreen } from '@/features/reports/screens/WeeklyReportScreen';
import { OverrideAuditScreen } from '@/features/reports/screens/OverrideAuditScreen';
import { Spinner } from '@/components/ui/Spinner';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { GeneralSettingsScreen } from '@/features/settings/screens/GeneralSettingsScreen';
import { ReceiptSettingsScreen } from '@/features/settings/screens/ReceiptSettingsScreen';
import { RegistersScreen } from '@/features/settings/screens/RegistersScreen';
import { PrinterSettingsScreen } from '@/features/settings/screens/PrinterSettingsScreen';
import { LANSettingsScreen } from '@/features/settings/screens/LANSettingsScreen';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { CustomerDetailScreen } from '@/features/customers/screens/CustomerDetailScreen';
import { SuppliersPage } from '@/features/suppliers/SuppliersPage';
import { SupplierDetailScreen } from '@/features/suppliers/screens/SupplierDetailScreen';

/**
 * TanStack Query client configuration.
 *
 * - staleTime: 30s — data is considered fresh for 30 seconds before background refetch
 * - retry: 1 — retry failed requests once before showing an error
 * - refetchOnWindowFocus: false — don't refetch when the Electron window gains focus
 */
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
    initializeAuth();
  }, [initializeAuth]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-neutral-950 text-foreground">
        <Spinner size="lg" />
        <span className="mt-4 text-sm text-neutral-400 font-mono">Loading Talaat Market System...</span>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="login" element={<LoginPage />} />

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
                path="purchases/*"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'manager']}>
                    <PlaceholderPage
                      title="Purchase Orders"
                      description="Create and manage purchase orders, receive goods, and update inventory automatically."
                      phase="Phase 3"
                    />
                  </ProtectedRoute>
                }
              />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="customers/:id" element={<CustomerDetailScreen />} />
              <Route
                path="reports/*"
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
                path="settings/*"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <SettingsLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="general" replace />} />
                <Route path="general" element={<GeneralSettingsScreen />} />
                <Route path="receipts" element={<ReceiptSettingsScreen />} />
                <Route path="registers" element={<RegistersScreen />} />
                <Route path="printers" element={<PrinterSettingsScreen />} />
                <Route path="lan" element={<LANSettingsScreen />} />
              </Route>

              {/* 404 fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <LANSyncManager />
      </ErrorBoundary>

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
