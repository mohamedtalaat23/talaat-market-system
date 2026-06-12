import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCreateSupplier, useUpdateSupplier, Supplier } from '../hooks/useSupplierQueries';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null; // If provided, we are editing
}

export function SupplierFormModal({ isOpen, onClose, supplier }: SupplierFormModalProps) {
  const { t } = useTranslation();
  const [supplierCode, setSupplierCode] = useState('');
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'suspended'>('active');

  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier(supplier?.id || 0);

  useEffect(() => {
    if (supplier) {
      setSupplierCode(supplier.supplier_code || '');
      setName(supplier.name || '');
      setContactName(supplier.contact_name || '');
      setPhone(supplier.phone || '');
      setEmail(supplier.email || '');
      setAddress(supplier.address || '');
      setNotes(supplier.notes || '');
      setStatus(supplier.status || 'active');
    } else {
      setSupplierCode('');
      setName('');
      setContactName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
      setStatus('active');
    }
  }, [supplier, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      supplier_code: supplierCode.trim() || null,
      name: name.trim(),
      contact_name: contactName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      status,
    };

    if (supplier) {
      // Omit supplier_code on update since it is not modifiable
      const { supplier_code, ...updatePayload } = payload;
      updateSupplier.mutate(updatePayload, {
        onSuccess: () => {
          onClose();
        },
      });
    } else {
      createSupplier.mutate(payload, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  const isPending = createSupplier.isPending || updateSupplier.isPending;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-input-border bg-card shadow-2xl overflow-hidden font-sans text-input-text animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-input-border bg-input-bg px-6 py-4">
          <h3 className="text-lg font-semibold tracking-wide text-input-text">
            {supplier ? t('suppliers.editProfile') : t('suppliers.registerNew')}
          </h3>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Supplier Code */}
            <div className="space-y-1.5 text-left rtl:text-right">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                {t('suppliers.supplierCode')}
              </label>
              <input
                type="text"
                disabled={!!supplier} // Do not modify supplier code on edit
                value={supplierCode}
                onChange={(e) => setSupplierCode(e.target.value)}
                placeholder={t('suppliers.supplierCodePlaceholder')}
                className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder-secondary/50 focus:border-success focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono"
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5 text-left rtl:text-right">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                {t('common.status')}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-sm text-input-text focus:border-success focus:outline-none transition-colors"
              >
                <option value="active">{t('suppliers.active')}</option>
                <option value="inactive">{t('suppliers.statusInactiveLabel')}</option>
                <option value="suspended">{t('suppliers.statusSuspendedLabel')}</option>
              </select>
            </div>

            {/* Name */}
            <div className="col-span-2 space-y-1.5 text-left rtl:text-right">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                {t('suppliers.supplierName')}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('suppliers.supplierNamePlaceholder')}
                className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder-secondary/50 focus:border-success focus:outline-none transition-colors"
              />
            </div>

            {/* Contact Name (Representative) */}
            <div className="col-span-2 space-y-1.5 text-left rtl:text-right">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                {t('suppliers.contactPerson')}
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={t('suppliers.contactPersonPlaceholder')}
                className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder-secondary/50 focus:border-success focus:outline-none transition-colors"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5 text-left rtl:text-right">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                {t('suppliers.phoneNumber')}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('suppliers.phonePlaceholder')}
                className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder-secondary/50 focus:border-success focus:outline-none transition-colors"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5 text-left rtl:text-right">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                {t('suppliers.emailAddress')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('suppliers.emailPlaceholder')}
                className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder-secondary/50 focus:border-success focus:outline-none transition-colors"
              />
            </div>

            {/* Address */}
            <div className="col-span-2 space-y-1.5 text-left rtl:text-right">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                {t('suppliers.officeAddress')}
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('suppliers.addressPlaceholder')}
                className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder-secondary/50 focus:border-success focus:outline-none transition-colors"
              />
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-1.5 text-left rtl:text-right">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                {t('suppliers.supplierNotes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('suppliers.notesPlaceholder')}
                rows={3}
                className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-sm text-input-text placeholder-secondary/50 focus:border-success focus:outline-none transition-colors resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-input-border pt-4 mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim()}
              className="flex items-center justify-center bg-success hover:bg-success/90 text-white shadow-lg shadow-success/10"
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
                  {t('suppliers.saving')}
                </>
              ) : supplier ? (
                t('suppliers.saveChanges')
              ) : (
                t('suppliers.registerProfile')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
