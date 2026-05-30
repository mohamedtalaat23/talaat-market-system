import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCustomerDetail, useDeleteCustomer } from '../hooks/useCustomerQueries';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';

export function CustomerDetailScreen() {
  const { id: idParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = Number(idParam);

  const [ledgerPage, setLedgerPage] = useState(1);

  const { data: customer, isLoading, error } = useCustomerDetail(id, ledgerPage);
  const deleteCustomer = useDeleteCustomer();
  const currentUserRole = useAuthStore((state) => state.user?.role);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const handleDelete = () => {
    if (!customer) return;
    if (confirm(`Are you sure you want to delete the customer profile for "${customer.name}"?`)) {
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
        <span className="mt-3 text-sm text-neutral-400 font-mono">Loading customer details...</span>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="text-center py-12 font-sans">
        <h3 className="text-lg font-semibold text-rose-500">Customer Not Found</h3>
        <p className="text-sm text-neutral-500 mt-2">
          The requested customer profile does not exist or has been deleted.
        </p>
        <button
          onClick={() => navigate('/customers')}
          className="mt-6 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold hover:bg-neutral-700 hover:text-neutral-100 transition-colors"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-neutral-100 p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-800 pb-5">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/customers')}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
            title="Back to Directory"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">{customer.name}</h1>
            <p className="text-xs font-mono text-neutral-500">Customer ID: #{customer.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaymentOpen(true)}
            className="flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-950/20"
          >
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Record Payment
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="rounded-lg bg-neutral-800 hover:bg-neutral-750 px-4 py-2.5 text-sm font-semibold hover:text-neutral-100 transition-colors border border-neutral-750"
          >
            Update Profile
          </button>
          {isAdminOrManager && (
            <button
              onClick={handleDelete}
              className="rounded-lg bg-rose-950 text-rose-400 hover:bg-rose-900 hover:text-rose-300 px-4 py-2.5 text-sm font-semibold transition-colors border border-rose-900/30"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details Cards */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-850 pb-2">
              Financial Status
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-neutral-500 uppercase font-semibold">Account Balance</span>
                <div
                  className={`text-2xl font-bold font-mono ${
                    customer.balance < 0
                      ? 'text-rose-500'
                      : customer.balance > 0
                      ? 'text-emerald-500'
                      : 'text-neutral-300'
                  }`}
                >
                  {Number(customer.balance).toFixed(2)} EGP
                </div>
                <div className="text-xs text-neutral-500 mt-1 font-sans">
                  {customer.balance < 0
                    ? 'Customer has outstanding credit debt.'
                    : customer.balance > 0
                    ? 'Customer has positive credit balance.'
                    : 'Account balance is completely settled.'}
                </div>
              </div>
              <div className="border-t border-neutral-850 pt-3">
                <span className="text-xs text-neutral-500 uppercase font-semibold">Loyalty Reward Points</span>
                <div className="text-xl font-bold text-amber-500">{customer.loyalty_points} Points</div>
              </div>
            </div>
          </div>

          {/* Profile Card */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-850 pb-2">
              Contact Information
            </h3>
            <div className="space-y-3.5 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 uppercase">Phone</span>
                <div className="font-semibold font-mono text-neutral-200">{customer.phone || '—'}</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 uppercase">Email</span>
                <div className="font-semibold text-neutral-200 truncate">{customer.email || '—'}</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 uppercase">Address</span>
                <div className="font-semibold text-neutral-200 leading-relaxed">{customer.address || '—'}</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 uppercase">Profile Notes</span>
                <div className="text-neutral-400 italic bg-neutral-950 p-2.5 rounded-lg border border-neutral-850 text-xs leading-relaxed">
                  {customer.notes || 'No notes on this customer profile.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: chronological transaction ledger */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 overflow-hidden">
            <div className="border-b border-neutral-800 bg-neutral-950 px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-neutral-200">Account Transaction History</h3>
              <span className="text-xs font-mono text-neutral-500">
                {customer.ledger_meta?.total ?? 0} Transactions
              </span>
            </div>

            {!customer.ledger || customer.ledger.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 mb-3">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-neutral-300">No Ledger Ledger Entries</h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                  There are no registered payments, credit purchases, or balance corrections for this account.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 bg-neutral-950/40 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      <th className="px-6 py-3.5">Date & Time</th>
                      <th className="px-6 py-3.5">Type</th>
                      <th className="px-6 py-3.5">Amount</th>
                      <th className="px-6 py-3.5">Reference ID</th>
                      <th className="px-6 py-3.5 max-w-xs truncate">Description / Notes</th>
                      <th className="px-6 py-3.5 text-right">Authorized By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800 font-sans">
                    {customer.ledger.map((tx) => (
                      <tr key={tx.id} className="hover:bg-neutral-850/20 transition-colors">
                        {/* Date */}
                        <td className="px-6 py-4 text-xs font-mono text-neutral-400">
                          {new Date(tx.created_at).toLocaleString()}
                        </td>

                        {/* Type */}
                        <td className="px-6 py-4 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                              tx.transaction_type === 'sale'
                                ? 'bg-rose-950/30 text-rose-400 border border-rose-900/20'
                                : tx.transaction_type === 'payment'
                                ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/20'
                                : 'bg-neutral-950 text-neutral-400 border border-neutral-800'
                            }`}
                          >
                            {tx.transaction_type === 'sale'
                              ? 'Credit Sale'
                              : tx.transaction_type === 'payment'
                              ? 'Installment'
                              : 'Adjustment'}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="px-6 py-4 text-xs font-mono font-semibold">
                          <span className={tx.amount < 0 ? 'text-rose-500' : 'text-emerald-500'}>
                            {tx.amount < 0 ? '' : '+'}
                            {Number(tx.amount).toFixed(2)} EGP
                          </span>
                        </td>

                        {/* Reference */}
                        <td className="px-6 py-4 text-xs font-mono text-neutral-400">
                          {tx.reference_id || '—'}
                        </td>

                        {/* Notes */}
                        <td className="px-6 py-4 text-xs text-neutral-500 max-w-xs truncate" title={tx.notes || ''}>
                          {tx.notes || '—'}
                        </td>

                        {/* Cashier / Operator */}
                        <td className="px-6 py-4 text-xs text-right text-neutral-400">
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
              <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-800 bg-neutral-950/40">
                <span className="text-xs font-mono text-neutral-500">
                  Page {customer.ledger_meta.page} of {customer.ledger_meta.totalPages}
                  {' • '}{customer.ledger_meta.total} total transactions
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                    disabled={ledgerPage <= 1}
                    className="rounded px-3 py-1.5 text-xs font-semibold bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setLedgerPage((p) => Math.min(customer.ledger_meta.totalPages, p + 1))}
                    disabled={ledgerPage >= customer.ledger_meta.totalPages}
                    className="rounded px-3 py-1.5 text-xs font-semibold bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
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
