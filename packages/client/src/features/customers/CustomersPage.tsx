import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers, useDeleteCustomer, Customer } from './hooks/useCustomerQueries';
import { CustomerFormModal } from './components/CustomerFormModal';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';

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
  const totalDebt =
    customers
      .filter((c) => c.balance < 0)
      .reduce((sum, c) => sum + Math.abs(Number(c.balance)), 0) || 0;
  const totalCredit =
    customers.filter((c) => c.balance > 0).reduce((sum, c) => sum + Number(c.balance), 0) || 0;

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
    if (confirm(t('customers.deleteConfirm').replace('{name}', name))) {
      deleteCustomer.mutate(id);
    }
  };

  const { t } = useTranslation();
  const isAdminOrManager = ['admin', 'manager'].includes(currentUserRole || '');

  return (
    <div className="space-y-6 font-sans text-foreground p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('customers.title')}
          </h1>
          <p className="text-sm text-secondary">{t('customers.description')}</p>
        </div>
        <Button
          onClick={handleCreate}
          className="flex items-center justify-center font-semibold bg-success hover:bg-success/90 text-white"
        >
          <svg
            className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('customers.registerCustomer')}
        </Button>
      </div>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Customers */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            {t('customers.totalCustomers')}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight">{totalCustomers}</span>
            <span className="text-xs text-neutral-500">{t('customers.activeProfiles')}</span>
          </div>
        </div>

        {/* Card 2: Total Credit (Deposits) */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            {t('customers.totalCredit')}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-success">
              {totalCredit.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-neutral-500">{t('customers.deposits')}</span>
          </div>
        </div>

        {/* Card 3: Total Debt (Receivables) */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            {t('customers.totalDebt')}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-danger">
              {totalDebt.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-neutral-500">{t('customers.receivables')}</span>
          </div>
        </div>
      </div>

      {/* Filter / Search section */}
      <div className="flex items-center rounded-lg border border-border bg-card/40 p-4">
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-neutral-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Reset page on search
            }}
            placeholder={t('customers.searchPlaceholder')}
            className="w-full rounded-lg border border-border bg-input py-2.5 ps-10 pe-4 text-sm text-foreground placeholder-neutral-500 focus:border-success focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Main List */}
      <div className="rounded-xl border border-border bg-card/20 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner size="md" />
            <span className="mt-3 text-sm text-secondary font-mono">{t('common.loading')}</span>
          </div>
        ) : !customers || customers.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-card border border-border text-secondary mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {t('customers.noCustomers')}
            </h3>
            <p className="text-sm text-secondary mt-1 max-w-sm mx-auto">
              {t('customers.noCustomersDesc')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-border bg-card text-xs font-semibold uppercase tracking-wider text-secondary">
                  <th className="px-6 py-4">{t('customers.name')}</th>
                  <th className="px-6 py-4">{t('customers.phone')}</th>
                  <th className="px-6 py-4 text-end">{t('customers.balance')}</th>
                  <th className="px-6 py-4 text-center">{t('customers.loyaltyPoints')}</th>
                  <th className="px-6 py-4 max-w-xs truncate">{t('customers.notes')}</th>
                  <th className="px-6 py-4 text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-card-hover/40 transition-colors group">
                    {/* Name */}
                    <td className="px-6 py-4 font-semibold text-foreground">
                      <button
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        className="hover:underline text-start font-semibold text-foreground hover:text-success focus:outline-none transition-colors"
                      >
                        {customer.name}
                      </button>
                    </td>

                    {/* Phone */}
                    <td className="px-6 py-4 text-sm font-mono text-secondary">
                      {customer.phone || '—'}
                    </td>

                    {/* Balance */}
                    <td className="px-6 py-4 text-sm text-end font-mono font-semibold">
                      <span
                        className={
                          customer.balance < 0
                            ? 'text-danger bg-danger/10 border border-danger/20 px-2.5 py-1 rounded-md'
                            : customer.balance > 0
                              ? 'text-success bg-success/90/10 border border-success/20 px-2.5 py-1 rounded-md'
                              : 'text-secondary'
                        }
                      >
                        {Number(customer.balance).toFixed(2)} EGP
                      </span>
                    </td>

                    {/* Loyalty points */}
                    <td className="px-6 py-4 text-sm text-center font-semibold text-foreground">
                      {customer.loyalty_points}
                    </td>

                    {/* Notes */}
                    <td className="px-6 py-4 text-sm text-secondary max-w-xs truncate">
                      {customer.notes || '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-sm text-end">
                      <div className="flex gap-2 justify-end rtl:justify-start">
                        <Button
                          onClick={() => navigate(`/customers/${customer.id}`)}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold"
                        >
                          {t('customers.details')}
                        </Button>
                        <Button
                          onClick={() => handlePayment(customer)}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold bg-success/90/10 hover:bg-success/90/20 border-success/20 text-success dark:text-success"
                        >
                          {t('customers.payment')}
                        </Button>
                        <Button
                          onClick={() => handleEdit(customer)}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold"
                        >
                          {t('common.edit')}
                        </Button>
                        {isAdminOrManager && (
                          <Button
                            onClick={() => handleDelete(customer.id, customer.name)}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold bg-destructive/10 hover:bg-destructive/20 border-destructive/20 text-destructive"
                          >
                            {t('common.delete')}
                          </Button>
                        )}
                      </div>
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
        <div className="flex items-center justify-between mt-6 bg-card/40 p-4 rounded-lg border border-border">
          <div className="text-sm text-secondary">
            {t('customers.showingCustomers')
              .replace('{count}', customers.length.toString())
              .replace('{total}', meta.total.toString())}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              variant="outline"
              size="sm"
            >
              {t('reports.previous')}
            </Button>
            <span className="flex items-center px-4 text-sm font-medium text-secondary">
              {t('reports.pageOf')
                .replace('{page}', page.toString())
                .replace('{total}', meta.totalPages.toString())}
            </span>
            <Button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
              variant="outline"
              size="sm"
            >
              {t('reports.next')}
            </Button>
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
