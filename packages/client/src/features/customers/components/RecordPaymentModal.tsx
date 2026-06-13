import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRecordPayment } from '../hooks/useCustomerQueries';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useTranslation } from '@/hooks/useTranslation';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: number;
  customerName: string;
  currentBalance: number;
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  currentBalance,
}: RecordPaymentModalProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recordPayment = useRecordPayment(customerId);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const paymentSchema = z.object({
      amount: z.coerce
        .number({ invalid_type_error: t('customers.amountNumberError') })
        .positive(t('customers.amountPositiveError')),
      notes: z
        .string()
        .trim()
        .max(255, t('customers.notesLengthError'))
        .optional()
        .or(z.literal('')),
    });

    const validationResult = paymentSchema.safeParse({
      amount: amount === '' ? undefined : Number(amount),
      notes,
    });

    if (!validationResult.success) {
      const errMessage = validationResult.error.errors[0]?.message || 'Invalid payment details';
      setError(errMessage);
      toast.error(errMessage);
      return;
    }

    const data = validationResult.data;

    recordPayment.mutate(
      {
        amount: data.amount,
        notes: data.notes || 'Manual customer account payment',
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  const numericBalance = Number(currentBalance) || 0;
  const parsedAmount = parseFloat(amount) || 0;
  const projectedBalance = numericBalance + parsedAmount;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-input-border bg-modal shadow-2xl overflow-hidden font-sans text-input-text animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-input-border bg-card px-6 py-4">
          <h3 className="text-lg font-semibold tracking-wide">{t('customers.paymentTitle')}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-secondary hover:bg-card-hover hover:text-input-text transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Info Card */}
          <div className="rounded-lg bg-input-bg border border-input-border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-secondary">{t('customers.customer')}:</span>
              <span className="font-semibold text-input-text">{customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-secondary">{t('customers.currentBalanceLabel')}:</span>
              <span
                className={`font-semibold font-mono ${
                  numericBalance < 0
                    ? 'text-danger'
                    : numericBalance > 0
                      ? 'text-success'
                      : 'text-input-text'
                }`}
              >
                {numericBalance.toFixed(2)} EGP
                {numericBalance < 0 && ` (${t('customers.debt')})`}
                {numericBalance > 0 && ` (${t('customers.credit')})`}
              </span>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
              {t('customers.paymentAmount')}
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('customers.paymentPlaceholder')}
              className={`w-full rounded-lg border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder:text-input-placeholder focus:outline-none transition-colors font-mono ${
                error
                  ? 'border-danger focus:border-danger'
                  : 'border-input-border focus:border-success'
              }`}
            />
            {error && <p className="text-xs text-danger mt-0.5">{error}</p>}
          </div>

          {/* Note input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
              {t('customers.paymentNotes')}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('customers.paymentNotesPlaceholder')}
              className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder:text-input-placeholder focus:border-success focus:outline-none transition-colors"
            />
          </div>

          {/* Projection Calculator */}
          {parsedAmount > 0 && (
            <div className="rounded-lg bg-input-bg/40 border border-input-border p-4 flex justify-between items-center text-sm">
              <span className="text-secondary">{t('customers.projectedBalance')}:</span>
              <span
                className={`font-semibold font-mono text-base ${
                  projectedBalance < 0
                    ? 'text-danger'
                    : projectedBalance > 0
                      ? 'text-success'
                      : 'text-input-text'
                }`}
              >
                {projectedBalance.toFixed(2)} EGP
              </span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-input-border pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={recordPayment.isPending}
              className="rounded-lg bg-card border border-input-border text-input-text hover:bg-card-hover px-5 py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={recordPayment.isPending || parsedAmount <= 0}
              className="flex items-center justify-center rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-50 transition-colors shadow-lg shadow-success/10"
            >
              {recordPayment.isPending ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin text-white rtl:ml-2 rtl:mr-0"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {t('customers.processing')}
                </>
              ) : (
                t('customers.submitPayment')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
