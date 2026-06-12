import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCustomerDetail, useDeleteCustomer } from '../hooks/useCustomerQueries';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';

export function CustomerDetailScreen() {
  const { id: idParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = Number(idParam);
  const { t, language } = useTranslation();

  const [ledgerPage, setLedgerPage] = useState(1);

  const { data: customer, isLoading, error } = useCustomerDetail(id, ledgerPage);
  const deleteCustomer = useDeleteCustomer();
  const currentUserRole = useAuthStore((state) => state.user?.role);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const handleDelete = () => {
    if (!customer) return;
    if (confirm(t('customers.deleteConfirm').replace('{name}', customer.name))) {
      deleteCustomer.mutate(customer.id, {
        onSuccess: () => {
          navigate('/customers');
        },
      });
    }
  };

  const isAdminOrManager = ['admin', 'manager'].includes(currentUserRole || '');

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center font-sans">
        <Spinner size="md" />
        <span className="mt-3 text-sm text-secondary font-mono">
          {t('customers.loadingDetails')}
        </span>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="text-center py-12 font-sans">
        <h3 className="text-lg font-semibold text-danger">{t('customers.notFound')}</h3>
        <p className="text-sm text-neutral-500 mt-2">{t('customers.notFoundDesc')}</p>
        <Button onClick={() => navigate('/customers')} variant="secondary" className="mt-6">
          {t('customers.backToDirectory')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-neutral-100 p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/customers')}
            className="rounded-lg p-1.5 text-secondary hover:bg-card-hover hover:text-neutral-100 transition-colors rtl:rotate-180"
            title={t('customers.backToDirectory')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">{customer.name}</h1>
            <p className="text-xs font-mono text-neutral-500">
              {t('customers.idLabel').replace('{id}', String(customer.id))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsPaymentOpen(true)}
            className="bg-success hover:bg-success/90 text-white shadow-lg shadow-success/10 gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {t('customers.payment')}
          </Button>
          <Button onClick={() => setIsFormOpen(true)} variant="outline">
            {t('customers.updateProfile')}
          </Button>
          {isAdminOrManager && (
            <Button onClick={handleDelete} variant="destructive">
              {t('customers.deleteLabel')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details Cards */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-secondary border-b border-border pb-2">
              {t('customers.financialStatus')}
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-neutral-500 uppercase font-semibold">
                  {t('customers.accountBalance')}
                </span>
                <div
                  className={`text-2xl font-bold font-mono ${
                    customer.balance < 0
                      ? 'text-danger'
                      : customer.balance > 0
                        ? 'text-success'
                        : 'text-foreground'
                  }`}
                >
                  {Number(customer.balance).toFixed(2)} EGP
                </div>
                <div className="text-xs text-neutral-500 mt-1 font-sans">
                  {customer.balance < 0
                    ? t('customers.balanceDebtDesc')
                    : customer.balance > 0
                      ? t('customers.balanceCreditDesc')
                      : t('customers.balanceSettledDesc')}
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <span className="text-xs text-neutral-500 uppercase font-semibold">
                  {t('customers.rewardPoints')}
                </span>
                <div className="text-xl font-bold text-warning">
                  {t('customers.rewardPointsVal').replace(
                    '{count}',
                    String(customer.loyalty_points),
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Profile Card */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-secondary border-b border-border pb-2">
              {t('customers.contactInfo')}
            </h3>
            <div className="space-y-3.5 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 uppercase">{t('customers.phone')}</span>
                <div className="font-semibold font-mono text-foreground">
                  {customer.phone || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 uppercase">{t('customers.email')}</span>
                <div className="font-semibold text-foreground truncate">
                  {customer.email || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 uppercase">{t('customers.address')}</span>
                <div className="font-semibold text-foreground leading-relaxed">
                  {customer.address || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 uppercase">
                  {t('customers.profileNotes')}
                </span>
                <div className="text-secondary italic bg-input p-2.5 rounded-lg border border-border text-xs leading-relaxed">
                  {customer.notes || t('customers.noProfileNotes')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: chronological transaction ledger */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-input px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                {t('customers.transactionHistory')}
              </h3>
              <span className="text-xs font-mono text-secondary">
                {t('customers.txCount').replace(
                  '{count}',
                  String(customer.ledger_meta?.total ?? 0),
                )}
              </span>
            </div>

            {!customer.ledger || customer.ledger.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-input border border-border text-secondary mb-3">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-foreground">
                  {t('customers.noTxEntries')}
                </h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                  {t('customers.noTxEntriesDesc')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-input/40 text-xs font-semibold uppercase tracking-wider text-secondary">
                      <th className="px-6 py-3.5 text-start">{t('customers.txDateTime')}</th>
                      <th className="px-6 py-3.5 text-start">{t('customers.txType')}</th>
                      <th className="px-6 py-3.5 text-start">{t('customers.txAmount')}</th>
                      <th className="px-6 py-3.5 text-start">{t('customers.txReference')}</th>
                      <th className="px-6 py-3.5 text-start max-w-xs truncate">
                        {t('customers.txNotes')}
                      </th>
                      <th className="px-6 py-3.5 text-end">{t('customers.txAuthorizedBy')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-sans">
                    {customer.ledger.map((tx) => (
                      <tr key={tx.id} className="hover:bg-card-hover/20 transition-colors">
                        {/* Date */}
                        <td className="px-6 py-4 text-xs font-mono text-secondary">
                          {new Date(tx.created_at).toLocaleString()}
                        </td>

                        {/* Type */}
                        <td className="px-6 py-4 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded text-xs uppercase font-bold tracking-wider ${
                              tx.transaction_type === 'sale'
                                ? 'bg-danger/15 text-danger border border-danger/30'
                                : tx.transaction_type === 'payment'
                                  ? 'bg-success/15 text-success border border-success/30'
                                  : 'bg-input text-secondary border border-border'
                            }`}
                          >
                            {tx.transaction_type === 'sale'
                              ? t('customers.txCreditSale')
                              : tx.transaction_type === 'payment'
                                ? t('customers.txInstallment')
                                : t('customers.txAdjustment')}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="px-6 py-4 text-xs font-mono font-semibold">
                          <span className={tx.amount < 0 ? 'text-danger' : 'text-success'}>
                            {tx.amount < 0 ? '' : '+'}
                            {Number(tx.amount).toFixed(2)} EGP
                          </span>
                        </td>

                        {/* Reference */}
                        <td className="px-6 py-4 text-xs font-mono text-secondary">
                          {tx.reference_id || '—'}
                        </td>

                        {/* Notes */}
                        <td
                          className="px-6 py-4 text-xs text-neutral-500 max-w-xs truncate"
                          title={tx.notes || ''}
                        >
                          {tx.notes || '—'}
                        </td>

                        {/* Cashier / Operator */}
                        <td className="px-6 py-4 text-xs text-end text-secondary">
                          {tx.created_by_name || 'System / Auto'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Ledger Pagination Controls */}
            {customer.ledger_meta && customer.ledger_meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-input/40">
                <span className="text-xs font-mono text-neutral-500">
                  {t('reports.pageOf')
                    .replace('{page}', String(customer.ledger_meta.page))
                    .replace('{total}', String(customer.ledger_meta.totalPages))}
                  {' • '}
                  {t('customers.totalTransactions').replace(
                    '{count}',
                    String(customer.ledger_meta.total),
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                    disabled={ledgerPage <= 1}
                    variant="secondary"
                    size="sm"
                  >
                    {language === 'ar' ? '←' : '←'} {t('reports.previous')}
                  </Button>
                  <Button
                    onClick={() =>
                      setLedgerPage((p) => Math.min(customer.ledger_meta.totalPages, p + 1))
                    }
                    disabled={ledgerPage >= customer.ledger_meta.totalPages}
                    variant="secondary"
                    size="sm"
                  >
                    {t('reports.next')} {language === 'ar' ? '→' : '→'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Dialog */}
      <CustomerFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        customer={customer}
      />

      {/* Payment Dialog */}
      <RecordPaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        customerId={customer.id}
        customerName={customer.name}
        currentBalance={customer.balance}
      />
    </div>
  );
}
