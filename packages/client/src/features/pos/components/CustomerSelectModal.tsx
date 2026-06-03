import { useState, useEffect, useRef } from 'react';
import { useCustomers, useCreateCustomer } from '@/features/customers/hooks/useCustomerQueries';
import { usePOSStore } from '../usePOSStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useDebounce } from '@/hooks/useDebounce';

interface CustomerSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerSelectModal({ isOpen, onClose }: CustomerSelectModalProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'create'>('search');
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const debouncedSearch = useDebounce(search, 300);
  const { data: response, isLoading } = useCustomers({ page: 1, limit: 10, search: debouncedSearch });
  const customers = response?.data || [];
  const createCustomer = useCreateCustomer();
  const selectCustomer = usePOSStore((state) => state.selectCustomer);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus trapping
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('search');
      setSearch('');
      setNewName('');
      setNewPhone('');
      // Auto-focus search input on mount
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === 'create') {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    } else {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [activeTab]);

  if (!isOpen) return null;

  const handleSelect = (customer: any) => {
    selectCustomer(customer);
    onClose();
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    createCustomer.mutate(
      {
        name: newName.trim(),
        phone: newPhone.trim() || null,
      },
      {
        onSuccess: (createdCustomer) => {
          selectCustomer(createdCustomer);
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-xl border border-border bg-neutral-900 shadow-2xl overflow-hidden font-sans text-neutral-100 animate-in fade-in zoom-in duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-input px-6 py-4">
          <h3 className="text-lg font-semibold tracking-wide">Select Cart Customer</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-secondary hover:bg-card-hover hover:text-neutral-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-input/30 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`border-b-2 px-4 py-3 text-sm font-semibold tracking-wide transition-colors focus:outline-none ${
              activeTab === 'search'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-secondary hover:text-neutral-200'
            }`}
          >
            Search Directory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`border-b-2 px-4 py-3 text-sm font-semibold tracking-wide transition-colors focus:outline-none ${
              activeTab === 'create'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-secondary hover:text-neutral-200'
            }`}
          >
            Quick Register
          </button>
        </div>

        {/* Tab 1: Search Directory */}
        {activeTab === 'search' && (
          <div className="p-6 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone number..."
                className="w-full rounded-lg border border-border bg-input py-2.5 pl-10 pr-4 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Results list */}
            <div className="max-h-60 overflow-y-auto rounded-lg border border-border divide-y divide-neutral-850 bg-input/20">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="h-5 w-5 animate-spin text-secondary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="ml-2.5 text-xs text-neutral-500 font-mono">Searching directory...</span>
                </div>
              ) : !customers || customers.length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-500 font-sans">
                  No matching customer profiles found.
                </div>
              ) : (
                customers.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => handleSelect(cust)}
                    className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-card-hover transition-colors focus:bg-neutral-800 focus:outline-none group"
                  >
                    <div>
                      <div className="font-semibold text-neutral-200 group-hover:text-emerald-400 transition-colors">
                        {cust.name}
                      </div>
                      {cust.phone && <div className="text-xs text-neutral-500 font-mono mt-0.5">{cust.phone}</div>}
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-xs font-mono font-semibold ${
                          cust.balance < 0
                            ? 'text-rose-500'
                            : cust.balance > 0
                            ? 'text-emerald-500'
                            : 'text-secondary'
                        }`}
                      >
                        {Number(cust.balance).toFixed(2)} EGP
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        {cust.balance < 0 ? 'Debt' : cust.balance > 0 ? 'Credit' : 'Settle'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Quick Register */}
        {activeTab === 'create' && (
          <form onSubmit={handleQuickCreate} className="p-6 space-y-4">
            {/* Quick Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Full Name *</label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter customer's name"
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Quick Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">Phone Number</label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="e.g. 01012345678"
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 border-t border-border pt-4 mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={createCustomer.isPending}
                className="rounded-lg bg-neutral-800 px-5 py-2.5 text-sm font-semibold hover:bg-card-hover disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createCustomer.isPending || !newName.trim()}
                className="flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-950/20"
              >
                {createCustomer.isPending ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Registering...
                  </>
                ) : (
                  'Register & Select'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
