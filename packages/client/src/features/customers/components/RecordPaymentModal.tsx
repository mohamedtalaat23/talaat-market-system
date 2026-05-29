import { useState, useEffect } from 'react';
import { useRecordPayment } from '../hooks/useCustomerQueries';

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
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const recordPayment = useRecordPayment(customerId);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setNotes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    recordPayment.mutate(
      {
        amount: parsedAmount,
        notes: notes.trim() || 'Manual customer account payment',
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const numericBalance = Number(currentBalance) || 0;
  const parsedAmount = parseFloat(amount) || 0;
  const projectedBalance = numericBalance + parsedAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl overflow-hidden font-sans text-neutral-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-4">
          <h3 className="text-lg font-semibold tracking-wide">Record Installment Payment</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Info Card */}
          <div className="rounded-lg bg-neutral-950 border border-neutral-800 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Customer:</span>
              <span className="font-semibold text-neutral-100">{customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Current Balance:</span>
              <span
                className={`font-semibold font-mono ${
                  numericBalance < 0
                    ? 'text-rose-500'
                    : numericBalance > 0
                    ? 'text-emerald-500'
                    : 'text-neutral-300'
                }`}
              >
                {numericBalance.toFixed(2)} EGP
                {numericBalance < 0 && ' (Debt)'}
                {numericBalance > 0 && ' (Credit)'}
              </span>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Payment Amount (EGP) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount customer is paying"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors font-mono"
            />
          </div>

          {/* Note input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Payment Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cash payment, bank transfer reference"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Projection Calculator */}
          {parsedAmount > 0 && (
            <div className="rounded-lg bg-neutral-950/40 border border-neutral-850 p-4 flex justify-between items-center text-sm">
              <span className="text-neutral-400">Projected Balance:</span>
              <span
                className={`font-semibold font-mono text-base ${
                  projectedBalance < 0
                    ? 'text-rose-500'
                    : projectedBalance > 0
                    ? 'text-emerald-500'
                    : 'text-neutral-300'
                }`}
              >
                {projectedBalance.toFixed(2)} EGP
              </span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 border-t border-neutral-800 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={recordPayment.isPending}
              className="rounded-lg bg-neutral-800 px-5 py-2.5 text-sm font-semibold hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordPayment.isPending || parsedAmount <= 0}
              className="flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-950/20"
            >
              {recordPayment.isPending ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : (
                'Submit Payment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
