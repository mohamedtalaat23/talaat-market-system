import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { AppLayout } from '@/components/layout/AppLayout';
import { PlaceholderPage } from '@/components/ui/PlaceholderPage';
import { Dashboard } from '@/features/dashboard/Dashboard';

/**
 * TanStack Query client configuration.
 *
 * - staleTime: 30s — data is considered fresh for 30 seconds before background refetch
 * - retry: 1 — retry failed requests once before showing an error
 * - refetchOnWindowFocus: false — don't refetch when the Electron window gains focus
 *   (this is a desktop app, not a browser tab)
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
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

/**
 * App root component.
 *
 * Provides:
 *   - BrowserRouter
 *   - QueryClientProvider (TanStack Query)
 *   - Toaster (react-hot-toast notifications)
 *   - Route definitions
 *
 * Authentication guard (Phase 3) will wrap the AppLayoutRoute.
 * For now, all routes are accessible without login.
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* All app routes share the AppLayout wrapper */}
          <Route element={<AppLayoutRoute />}>
            <Route index element={<Dashboard />} />

            {/* Phase 2: POS */}
            <Route
              path="pos"
              element={
                <PlaceholderPage
                  title="Point of Sale"
                  description="The full-featured POS terminal with barcode scanning, cart management, and payment processing."
                  phase="Phase 2"
                />
              }
            />

            {/* Phase 3: Products */}
            <Route
              path="products/*"
              element={
                <PlaceholderPage
                  title="Product Management"
                  description="Add, edit, and manage your product catalog with barcodes, pricing, and categories."
                  phase="Phase 3"
                />
              }
            />

            {/* Phase 3: Inventory */}
            <Route
              path="inventory/*"
              element={
                <PlaceholderPage
                  title="Inventory Management"
                  description="Track stock levels, set alerts, adjust inventory, and manage stock counts."
                  phase="Phase 3"
                />
              }
            />

            {/* Phase 3: Suppliers */}
            <Route
              path="suppliers/*"
              element={
                <PlaceholderPage
                  title="Suppliers"
                  description="Manage your supplier directory, contact information, and payment terms."
                  phase="Phase 3"
                />
              }
            />

            {/* Phase 3: Purchases */}
            <Route
              path="purchases/*"
              element={
                <PlaceholderPage
                  title="Purchase Orders"
                  description="Create and manage purchase orders, receive goods, and update inventory automatically."
                  phase="Phase 3"
                />
              }
            />

            {/* Phase 5: Customers */}
            <Route
              path="customers/*"
              element={
                <PlaceholderPage
                  title="Customer Management"
                  description="Track customer information, purchase history, and loyalty points."
                  phase="Phase 5"
                />
              }
            />

            {/* Phase 5: Employees */}
            <Route
              path="employees/*"
              element={
                <PlaceholderPage
                  title="Employee Management"
                  description="Manage employee accounts, roles, and access permissions."
                  phase="Phase 5"
                />
              }
            />

            {/* Phase 4: Reports */}
            <Route
              path="reports/*"
              element={
                <PlaceholderPage
                  title="Reports & Analytics"
                  description="Daily sales, inventory reports, profit & loss, top products, and cashier performance."
                  phase="Phase 4"
                />
              }
            />

            {/* Phase 5: Settings */}
            <Route
              path="settings/*"
              element={
                <PlaceholderPage
                  title="Settings"
                  description="Configure store info, receipt layout, backup schedule, and system preferences."
                  phase="Phase 5"
                />
              }
            />

            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>

      {/* Toast notifications — top-right, non-blocking for cashier workflow */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
            borderRadius: '8px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1e293b' },
          },
          error: {
            iconTheme: { primary: '#f43f5e', secondary: '#1e293b' },
          },
        }}
      />
    </QueryClientProvider>
  );
}
