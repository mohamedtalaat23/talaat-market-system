import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCreateCustomer, useUpdateCustomer, Customer } from '../hooks/useCustomerQueries';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';
import { User, Phone, Mail, MapPin, Wallet, Gift, AlignLeft, UserPlus, UserCog, X } from 'lucide-react';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null; // If provided, we are editing
}

export function CustomerFormModal({ isOpen, onClose, customer }: CustomerFormModalProps) {
  const { t } = useTranslation();
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
      name: z
        .string()
        .trim()
        .min(1, t('employees.nameRequired'))
        .max(150, 'Name must be under 150 characters'),
      phone: z
        .string()
        .trim()
        .regex(/^[0-9+-\s]*$/, t('customers.phoneFormatError'))
        .max(20, 'Phone must be under 20 characters')
        .optional()
        .or(z.literal('')),
      email: z.string().trim().email('Invalid email address format').optional().or(z.literal('')),
      address: z
        .string()
        .trim()
        .max(255, 'Address must be under 255 characters')
        .optional()
        .or(z.literal('')),
      notes: z
        .string()
        .trim()
        .max(1000, 'Notes must be under 1000 characters')
        .optional()
        .or(z.literal('')),
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
      toast.error(t('customers.validationFailed'));
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

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-text">
      <div className="w-full max-w-2xl rounded-xl border-none bg-card shadow-2xl overflow-hidden font-sans text-foreground animate-fade-in relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-4 select-none">
          <h3 id="customer-modal-title" className="text-lg font-bold text-primary flex items-center gap-2">
            {customer ? <UserCog className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            {customer
              ? t('common.edit') + ' ' + t('customers.title')
              : t('customers.registerCustomer')}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-secondary hover:text-foreground hover:bg-card-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {t('customers.name')} *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('customers.name')}
                className={`w-full rounded-lg border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder:text-input-placeholder focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm ${
                  errors.name
                    ? 'border-danger focus:ring-danger/40 focus:border-danger'
                    : 'border-input-border'
                }`}
              />
              {errors.name && <p className="text-xs text-danger mt-0.5">{errors.name}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                {t('customers.phone')}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 01012345678"
                className={`w-full rounded-lg border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder:text-input-placeholder focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm ${
                  errors.phone
                    ? 'border-danger focus:ring-danger/40 focus:border-danger'
                    : 'border-input-border'
                }`}
              />
              {errors.phone && <p className="text-xs text-danger mt-0.5">{errors.phone}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {t('suppliers.email')}
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@domain.com"
                className={`w-full rounded-lg border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder:text-input-placeholder focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm ${
                  errors.email
                    ? 'border-danger focus:ring-danger/40 focus:border-danger'
                    : 'border-input-border'
                }`}
              />
              {errors.email && <p className="text-xs text-danger mt-0.5">{errors.email}</p>}
            </div>

            {/* Address */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {t('customers.address')}
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('customers.address')}
                className={`w-full rounded-lg border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder:text-input-placeholder focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm ${
                  errors.address
                    ? 'border-danger focus:ring-danger/40 focus:border-danger'
                    : 'border-input-border'
                }`}
              />
              {errors.address && <p className="text-xs text-danger mt-0.5">{errors.address}</p>}
            </div>

            {/* Initial Balance - Only for NEW customers */}
            {!customer && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  {t('customers.balance')} (EGP)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0.00"
                  className={`w-full rounded-lg border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder:text-input-placeholder focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm ${
                    errors.balance
                      ? 'border-danger focus:ring-danger/40 focus:border-danger'
                      : 'border-input-border'
                  }`}
                />
                {errors.balance && <p className="text-xs text-danger mt-0.5">{errors.balance}</p>}
              </div>
            )}

            {/* Loyalty Points */}
            <div className={customer ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
              <label className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5" />
                {t('customers.loyaltyPoints')}
              </label>
              <input
                type="number"
                min="0"
                value={loyaltyPoints}
                onChange={(e) => setLoyaltyPoints(e.target.value)}
                placeholder="0"
                className={`w-full rounded-lg border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder:text-input-placeholder focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm ${
                  errors.loyalty_points
                    ? 'border-danger focus:ring-danger/40 focus:border-danger'
                    : 'border-input-border'
                }`}
              />
              {errors.loyalty_points && (
                <p className="text-xs text-danger mt-0.5">{errors.loyalty_points}</p>
              )}
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                <AlignLeft className="w-3.5 h-3.5" />
                {t('customers.notes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('customers.notes')}
                rows={3}
                className={`w-full rounded-lg border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder:text-input-placeholder focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm resize-none ${
                  errors.notes
                    ? 'border-danger focus:ring-danger/40 focus:border-danger'
                    : 'border-input-border'
                }`}
              />
              {errors.notes && <p className="text-xs text-danger mt-0.5">{errors.notes}</p>}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-input-border pt-4 mt-6">
            <Button
              type="button"
              onClick={onClose}
              disabled={isPending}
              variant="outline"
              className="px-5 py-2.5"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim()}
              className="bg-success hover:bg-success/90 text-white px-5 py-2.5 shadow-lg shadow-success/10"
            >
              {isPending ? (
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
                  {t('settings.saving')}
                </>
              ) : customer ? (
                t('common.save')
              ) : (
                t('common.add')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
