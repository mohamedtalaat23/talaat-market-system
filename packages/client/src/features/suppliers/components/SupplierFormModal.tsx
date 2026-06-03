import { useState, useEffect } from 'react';
import { useCreateSupplier, useUpdateSupplier, Supplier } from '../hooks/useSupplierQueries';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null; // If provided, we are editing
}

export function SupplierFormModal({ isOpen, onClose, supplier }: SupplierFormModalProps) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-neutral-900 shadow-2xl overflow-hidden font-sans text-neutral-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-input px-6 py-4">
          <h3 className="text-lg font-semibold tracking-wide">
            {supplier ? 'Edit Supplier Profile' : 'Register New Supplier'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-secondary hover:bg-card-hover hover:text-neutral-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Supplier Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Supplier Code</label>
              <input
                type="text"
                disabled={!!supplier} // Do not modify supplier code on edit
                value={supplierCode}
                onChange={(e) => setSupplierCode(e.target.value)}
                placeholder="e.g. SUP-0001 (Auto if blank)"
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono"
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none transition-colors"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive (Warning in POS)</option>
                <option value="suspended">Suspended (Locked in POS)</option>
              </select>
            </div>

            {/* Name */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Supplier Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter supplier or company name"
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Contact Name (Representative) */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                Contact Person (Representative)
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Enter representative's name"
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 01012345678"
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supplier@company.com"
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Address */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Office Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter street, office location"
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Supplier Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add special terms, shipping details, or internal notes..."
                rows={3}
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 border-t border-border pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg bg-neutral-800 px-5 py-2.5 text-sm font-semibold hover:bg-card-hover disabled:opacity-50 transition-colors"
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
              ) : supplier ? (
                'Save Changes'
              ) : (
                'Register Profile'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
