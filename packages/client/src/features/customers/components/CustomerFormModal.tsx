import { useState, useEffect } from 'react';
import { useCreateCustomer, useUpdateCustomer, Customer } from '../hooks/useCustomerQueries';
import { z } from 'zod';
import toast from 'react-hot-toast';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null; // If provided, we are editing
}

export function CustomerFormModal({ isOpen, onClose, customer }: CustomerFormModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [balance, setBalance] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState('0');
  
  // Custom validation error state mapping field names to message strings
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer(customer?.id || 0);

  useEffect(() => {
    setErrors({});
    if (customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setEmail(customer.email || '');
      setAddress(customer.address || '');
      setNotes(customer.notes || '');
      setLoyaltyPoints(String(customer.loyalty_points || '0'));
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
      setBalance('');
      setLoyaltyPoints('0');
    }
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side defensive Zod schema validation
    const customerSchema = z.object({
      name: z.string().trim().min(1, 'Full name is required').max(150, 'Name must be under 150 characters'),
      phone: z
        .string()
        .trim()
        .regex(/^[0-9+-\s]*$/, 'Invalid phone number format')
        .max(20, 'Phone must be under 20 characters')
        .optional()
        .or(z.literal('')),
      email: z.string().trim().email('Invalid email address format').optional().or(z.literal('')),
      address: z.string().trim().max(255, 'Address must be under 255 characters').optional().or(z.literal('')),
      notes: z.string().trim().max(1000, 'Notes must be under 1000 characters').optional().or(z.literal('')),
      loyalty_points: z.coerce
        .number()
        .int('Loyalty points must be an integer')
        .nonnegative('Loyalty points must be non-negative')
        .default(0),
      balance: z.coerce.number().optional(),
    });

    const validationResult = customerSchema.safeParse({
      name,
      phone,
      email,
      address,
      notes,
      loyalty_points: loyaltyPoints === '' ? 0 : Number(loyaltyPoints),
      balance: balance === '' ? undefined : Number(balance),
    });

    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      validationResult.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      toast.error('Validation failed. Please correct the fields.');
      return;
    }

    const data = validationResult.data;

    const payload = {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      notes: data.notes || null,
      loyalty_points: data.loyalty_points,
      ...(!customer && data.balance !== undefined ? { balance: data.balance } : {}),
    };

    if (customer) {
      updateCustomer.mutate(payload, {
        onSuccess: () => {
          onClose();
        },
      });
    } else {
      createCustomer.mutate(payload, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  const isPending = createCustomer.isPending || updateCustomer.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl overflow-hidden font-sans text-neutral-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-4">
          <h3 className="text-lg font-semibold tracking-wide">
            {customer ? 'Edit Customer Profile' : 'Register New Customer'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter customer's full name"
                className={`w-full rounded-lg border bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors ${
                  errors.name ? 'border-rose-500 focus:border-rose-500' : 'border-neutral-800 focus:border-emerald-500'
                }`}
              />
              {errors.name && <p className="text-xs text-rose-500 mt-0.5">{errors.name}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 01012345678"
                className={`w-full rounded-lg border bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors ${
                  errors.phone ? 'border-rose-500 focus:border-rose-500' : 'border-neutral-800 focus:border-emerald-500'
                }`}
              />
              {errors.phone && <p className="text-xs text-rose-500 mt-0.5">{errors.phone}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Email Address</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@domain.com"
                className={`w-full rounded-lg border bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors ${
                  errors.email ? 'border-rose-500 focus:border-rose-500' : 'border-neutral-800 focus:border-emerald-500'
                }`}
              />
              {errors.email && <p className="text-xs text-rose-500 mt-0.5">{errors.email}</p>}
            </div>

            {/* Address */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Physical Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter street, city details"
                className={`w-full rounded-lg border bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors ${
                  errors.address ? 'border-rose-500 focus:border-rose-500' : 'border-neutral-800 focus:border-emerald-500'
                }`}
              />
              {errors.address && <p className="text-xs text-rose-500 mt-0.5">{errors.address}</p>}
            </div>

            {/* Initial Balance - Only for NEW customers */}
            {!customer && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Initial Balance (EGP)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0.00 (Debt: -50, Credit: 50)"
                  className={`w-full rounded-lg border bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors ${
                    errors.balance ? 'border-rose-500 focus:border-rose-500' : 'border-neutral-800 focus:border-emerald-500'
                  }`}
                />
                {errors.balance && <p className="text-xs text-rose-500 mt-0.5">{errors.balance}</p>}
              </div>
            )}

            {/* Loyalty Points */}
            <div className={customer ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Loyalty Points</label>
              <input
                type="number"
                min="0"
                value={loyaltyPoints}
                onChange={(e) => setLoyaltyPoints(e.target.value)}
                placeholder="0"
                className={`w-full rounded-lg border bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors ${
                  errors.loyalty_points ? 'border-rose-500 focus:border-rose-500' : 'border-neutral-800 focus:border-emerald-500'
                }`}
              />
              {errors.loyalty_points && <p className="text-xs text-rose-500 mt-0.5">{errors.loyalty_points}</p>}
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Internal Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add special instructions, credit limits, or notes..."
                rows={3}
                className={`w-full rounded-lg border bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors resize-none ${
                  errors.notes ? 'border-rose-500 focus:border-rose-500' : 'border-neutral-800 focus:border-emerald-500'
                }`}
              />
              {errors.notes && <p className="text-xs text-rose-500 mt-0.5">{errors.notes}</p>}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 border-t border-neutral-800 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg bg-neutral-800 px-5 py-2.5 text-sm font-semibold hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-950/20"
            >
              {isPending ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : customer ? (
                'Save Changes'
              ) : (
                'Create Profile'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
