import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers, useDeleteCustomer, Customer } from './hooks/useCustomerQueries';
import { CustomerFormModal } from './components/CustomerFormModal';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';
import { useDebounce } from '@/hooks/useDebounce';

export function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const { data: response, isLoading } = useCustomers({ page, limit: 10, search: debouncedSearch });
  const customers = response?.data || [];
  const meta = response?.meta;
  const deleteCustomer = useDeleteCustomer();
  const currentUserRole = useAuthStore((state) => state.user?.role);

  // Derived KPI Stats
  const totalCustomers = meta?.total || 0;
  // NOTE: In a real scenario, total credit and debt should be fetched from the backend 
  // since this is now paginated and we only have the current page's balances.
  const totalDebt = customers
    .filter((c) => c.balance < 0)
    .reduce((sum, c) => sum + Math.abs(Number(c.balance)), 0) || 0;
  const totalCredit = customers
    .filter((c) => c.balance > 0)
    .reduce((sum, c) => sum + Number(c.balance), 0) || 0;

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedCustomer(null);
    setIsFormOpen(true);
  };

  const handlePayment = (customer: Customer) => {
    setPaymentCustomer(customer);
    setIsPaymentOpen(true);
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete the customer profile for "${name}"?`)) {
      deleteCustomer.mutate(id);
    }
  };

  const isAdminOrManager = ['admin', 'manager'].includes(currentUserRole || '');

  return (
    <div className="space-y-6 font-sans text-neutral-100 p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Customer Directory</h1>
          <p className="text-sm text-secondary">
            Manage customer accounts, track credit balances/debts, and loyalty points.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-950/20"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Register Customer
        </button>
      </div>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Customers */}
        <div className="rounded-xl border border-border bg-neutral-900/50 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Total Customers</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight">{totalCustomers}</span>
            <span className="text-xs text-neutral-500">Active Profiles</span>
          </div>
        </div>

        {/* Card 2: Total Credit (Deposits) */}
        <div className="rounded-xl border border-border bg-neutral-900/50 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Total Customer Credit</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-emerald-500">{totalCredit.toFixed(2)}</span>
            <span className="text-xs font-mono text-neutral-500">EGP Deposits</span>
          </div>
        </div>

        {/* Card 3: Total Debt (Receivables) */}
        <div className="rounded-xl border border-border bg-neutral-900/50 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Total Outstanding Debt</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-rose-500">{totalDebt.toFixed(2)}</span>
            <span className="text-xs font-mono text-neutral-500">EGP Receivables</span>
          </div>
        </div>
      </div>

      {/* Filter / Search section */}
      <div className="flex items-center rounded-lg border border-border bg-neutral-900/40 p-4">
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Reset page on search
            }}
            placeholder="Search by name or phone number..."
            className="w-full rounded-lg border border-border bg-input py-2.5 pl-10 pr-4 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Main List */}
      <div className="rounded-xl border border-border bg-neutral-900/20 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner size="md" />
            <span className="mt-3 text-sm text-secondary font-mono">Fetching customer directory...</span>
          </div>
        ) : !customers || customers.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 border border-border text-secondary mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-neutral-200">No Customers Found</h3>
            <p className="text-sm text-neutral-500 mt-1 max-w-sm mx-auto">
              Try adjusting your search criteria or register a new customer profile.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-input text-xs font-semibold uppercase tracking-wider text-secondary">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4 text-right">Balance</th>
                  <th className="px-6 py-4 text-center">Loyalty Points</th>
                  <th className="px-6 py-4 max-w-xs truncate">Notes</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-neutral-850/40 transition-colors group">
                    {/* Name */}
                    <td className="px-6 py-4 font-semibold text-neutral-100">
                      <button
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        className="hover:underline text-left font-semibold text-neutral-200 hover:text-emerald-400 focus:outline-none transition-colors"
                      >
                        {customer.name}
                      </button>
                    </td>

                    {/* Phone */}
                    <td className="px-6 py-4 text-sm font-mono text-secondary">
                      {customer.phone || '—'}
                    </td>

                    {/* Balance */}
                    <td className="px-6 py-4 text-sm text-right font-mono font-semibold">
                      <span
                        className={
                          customer.balance < 0
                            ? 'text-rose-500 bg-rose-950/20 border border-rose-900/30 px-2.5 py-1 rounded-md'
                            : customer.balance > 0
                            ? 'text-emerald-500 bg-emerald-950/20 border border-emerald-900/30 px-2.5 py-1 rounded-md'
                            : 'text-secondary'
                        }
                      >
                        {Number(customer.balance).toFixed(2)} EGP
                      </span>
                    </td>

                    {/* Loyalty points */}
                    <td className="px-6 py-4 text-sm text-center font-semibold text-neutral-300">
                      {customer.loyalty_points}
                    </td>

                    {/* Notes */}
                    <td className="px-6 py-4 text-sm text-neutral-500 max-w-xs truncate">
                      {customer.notes || '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-sm text-right space-x-2">
                      <button
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        className="rounded bg-neutral-800 hover:bg-neutral-750 px-2.5 py-1.5 text-xs font-semibold hover:text-neutral-100 transition-colors"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => handlePayment(customer)}
                        className="rounded bg-emerald-950 text-emerald-400 hover:bg-emerald-900 hover:text-emerald-300 border border-emerald-900/30 px-2.5 py-1.5 text-xs font-semibold transition-colors"
                      >
                        Payment
                      </button>
                      <button
                        onClick={() => handleEdit(customer)}
                        className="rounded bg-neutral-800 hover:bg-neutral-750 px-2.5 py-1.5 text-xs font-semibold hover:text-neutral-100 transition-colors"
                      >
                        Edit
                      </button>
                      {isAdminOrManager && (
                        <button
                          onClick={() => handleDelete(customer.id, customer.name)}
                          className="rounded bg-rose-950 text-rose-400 hover:bg-rose-900 hover:text-rose-300 border border-rose-900/30 px-2.5 py-1.5 text-xs font-semibold transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 bg-neutral-900/40 p-4 rounded-lg border border-border">
          <div className="text-sm text-secondary">
            Showing <span className="font-semibold text-neutral-200">{customers.length}</span> of <span className="font-semibold text-neutral-200">{meta.total}</span> customers
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded bg-neutral-800 text-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-card-hover transition-colors text-sm font-medium border border-border"
            >
              Previous
            </button>
            <span className="flex items-center px-4 text-sm font-medium text-neutral-300">
              Page {page} of {meta.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
              className="px-4 py-2 rounded bg-neutral-800 text-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-card-hover transition-colors text-sm font-medium border border-border"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <CustomerFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
      />

      {/* Payment Dialog */}
      {paymentCustomer && (
        <RecordPaymentModal
          isOpen={isPaymentOpen}
          onClose={() => {
            setIsPaymentOpen(false);
            setPaymentCustomer(null);
          }}
          customerId={paymentCustomer.id}
          customerName={paymentCustomer.name}
          currentBalance={paymentCustomer.balance}
        />
      )}
    </div>
  );
}
