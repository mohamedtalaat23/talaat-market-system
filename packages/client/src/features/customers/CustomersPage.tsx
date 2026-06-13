import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Wallet,
  AlertCircle,
  Search,
  Plus,
  Eye,
  CreditCard,
  Edit2,
  Trash2,
  UserCircle,
} from 'lucide-react';
import { useCustomers, useDeleteCustomer, Customer } from './hooks/useCustomerQueries';
import { CustomerFormModal } from './components/CustomerFormModal';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Pagination } from '@/components/ui/Pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

function CustomerAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary border border-primary/20">
      {initial}
    </span>
  );
}

export function CustomersPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const debouncedSearch = useDebounce(search, 300);
  const { data: response, isLoading } = useCustomers({
    page,
    limit: 10,
    search: debouncedSearch,
    sortBy,
    sortOrder,
  });
  const customers = response?.data || [];
  const meta = response?.meta;
  const deleteCustomer = useDeleteCustomer();
  const currentUserRole = useAuthStore((state) => state.user?.role);

  const totalCustomers = meta?.total || 0;
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

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const isAdminOrManager = ['admin', 'manager'].includes(currentUserRole || '');

  return (
    <PageContainer
      title={t('customers.title')}
      description={t('customers.description')}
      actions={
        <Button
          onClick={handleCreate}
          className="flex items-center gap-1.5 font-semibold bg-success hover:bg-success/90 text-white"
        >
          <Plus size={16} />
          {t('customers.registerCustomer')}
        </Button>
      }
    >
      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card hover:shadow-md transition-shadow group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              {t('customers.totalCustomers')}
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {totalCustomers}
            </div>
            <p className="text-xs text-secondary mt-1">{t('customers.activeProfiles')}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card hover:shadow-md transition-shadow group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              {t('customers.totalCredit')}
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-success font-mono tabular-nums">
              {totalCredit.toFixed(2)}
            </div>
            <p className="text-xs text-secondary mt-1">{t('customers.deposits')}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card hover:shadow-md transition-shadow group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              {t('customers.totalDebt')}
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4 text-danger" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-danger font-mono tabular-nums">
              {totalDebt.toFixed(2)}
            </div>
            <p className="text-xs text-secondary mt-1">{t('customers.receivables')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border bg-card/40 p-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            size={18}
            className="absolute inset-y-0 start-3 my-auto text-secondary pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('customers.searchPlaceholder')}
            className="w-full rounded-lg border border-border bg-input py-2.5 ps-10 pe-4 text-sm text-foreground placeholder:text-secondary/60 focus:border-success focus:outline-none focus:ring-1 focus:ring-success/30 transition-colors"
          />
        </div>
        {!isLoading && customers.length > 0 && meta && (
          <p className="text-xs text-secondary sm:ms-auto">
            {t('customers.showingCustomers')
              .replace('{count}', customers.length.toString())
              .replace('{total}', meta.total.toString())}
          </p>
        )}
      </div>

      {/* Customer table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner size="md" />
            <span className="mt-3 text-sm text-secondary">{t('common.loading')}</span>
          </div>
        ) : !customers || customers.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-card border border-border text-secondary mb-4">
              <UserCircle size={28} />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {t('customers.noCustomers')}
            </h3>
            <p className="text-sm text-secondary mt-1 max-w-sm mx-auto">
              {t('customers.noCustomersDesc')}
            </p>
            <Button onClick={handleCreate} className="mt-4 bg-success hover:bg-success/90 text-white">
              <Plus size={16} className="me-1.5" />
              {t('customers.registerCustomer')}
            </Button>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="table-header-sticky border-b border-border bg-card/90 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-secondary">
                    <SortableHeader
                      label={t('customers.name')}
                      field="name"
                      currentSortBy={sortBy}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                      className="px-6 py-4"
                    />
                    <th className="px-6 py-4 text-start font-semibold">{t('customers.phone')}</th>
                    <SortableHeader
                      label={t('customers.balance')}
                      field="balance"
                      align="end"
                      currentSortBy={sortBy}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                      className="px-6 py-4"
                    />
                    <SortableHeader
                      label={t('customers.lastActivity')}
                      field="lastActivity"
                      align="center"
                      currentSortBy={sortBy}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                      className="px-6 py-4"
                    />
                    <th className="px-6 py-4 text-start font-semibold max-w-xs">
                      {t('customers.notes')}
                    </th>
                    <th className="px-6 py-4 text-end font-semibold">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="table-row-hover hover:bg-card-hover/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <button
                          onClick={() => navigate(`/customers/${customer.id}`)}
                          className="flex items-center gap-3 text-start font-semibold text-foreground hover:text-success focus:outline-none transition-colors min-w-0"
                          title={customer.name}
                        >
                          <CustomerAvatar name={customer.name} />
                          <span className="truncate max-w-[180px]">{customer.name}</span>
                        </button>
                      </td>

                      <td className="px-6 py-4 text-sm font-mono text-secondary">
                        {customer.phone || <span className="text-secondary/50">—</span>}
                      </td>

                      <td className="px-6 py-4 text-sm text-end font-mono tabular-nums">
                        <span
                          className={
                            customer.balance < 0
                              ? 'inline-flex items-center rounded-md bg-danger/10 border border-danger/20 px-2.5 py-1 text-xs font-semibold text-danger'
                              : customer.balance > 0
                                ? 'inline-flex items-center rounded-md bg-success/10 border border-success/20 px-2.5 py-1 text-xs font-semibold text-success'
                                : 'text-secondary'
                          }
                        >
                          {Number(customer.balance).toFixed(2)} EGP
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-center text-secondary">
                        {new Date(customer.updated_at).toLocaleDateString()}
                      </td>

                      <td
                        className="px-6 py-4 text-sm text-secondary max-w-[200px] truncate"
                        title={customer.notes || ''}
                      >
                        {customer.notes || <span className="text-secondary/50">—</span>}
                      </td>

                      <td className="px-6 py-4 text-sm text-end">
                        <div className="flex gap-1.5 justify-end rtl:justify-start flex-wrap">
                          <Button
                            onClick={() => navigate(`/customers/${customer.id}`)}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold"
                          >
                            <Eye size={12} className="me-1 rtl:ms-1 rtl:me-0" />
                            {t('customers.details')}
                          </Button>
                          <Button
                            onClick={() => handlePayment(customer)}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold bg-success/10 hover:bg-success/20 border-success/20 text-success"
                          >
                            <CreditCard size={12} className="me-1 rtl:ms-1 rtl:me-0" />
                            {t('customers.payment')}
                          </Button>
                          <Button
                            onClick={() => handleEdit(customer)}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold"
                          >
                            <Edit2 size={12} className="me-1 rtl:ms-1 rtl:me-0" />
                            {t('common.edit')}
                          </Button>
                          {isAdminOrManager && (
                            <Button
                              onClick={() => handleDelete(customer.id, customer.name)}
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-semibold bg-destructive/10 hover:bg-destructive/20 border-destructive/20 text-destructive"
                            >
                              <Trash2 size={12} className="me-1 rtl:ms-1 rtl:me-0" />
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

            {meta && meta.totalPages > 1 && (
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                limit={meta.limit}
                onPageChange={setPage}
                itemName="customers"
              />
            )}
          </>
        )}
      </div>

      <CustomerFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
      />

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
    </PageContainer>
  );
}
