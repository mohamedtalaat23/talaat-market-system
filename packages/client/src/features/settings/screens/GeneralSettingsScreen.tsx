import React, { useState, useEffect, useMemo } from 'react';
import { useSettings, useUpdateSettings } from '../hooks/useSettingsQueries';
import { Spinner } from '@/components/ui/Spinner';
import { useTranslation } from '@/hooks/useTranslation';
import toast from 'react-hot-toast';

export function GeneralSettingsScreen() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useSettings();
  const { mutate: updateSettings, isPending } = useUpdateSettings();

  const [form, setForm] = useState({
    store_name: '',
    store_address: '',
    store_phone: '',
    tax_id: '',
    currency_symbol: 'EGP',
    tax_rate: 0,
    timezone: 'Africa/Cairo',
    date_format: 'DD/MM/YYYY',
  });

  // Load initial settings
  const loadInitialSettings = () => {
    if (settings) {
      setForm({
        store_name: settings.store_name || '',
        store_address: settings.store_address || '',
        store_phone: settings.store_phone || '',
        tax_id: settings.tax_id || '',
        currency_symbol: settings.currency_symbol || 'EGP',
        tax_rate: settings.tax_rate ? Number(settings.tax_rate) : 0,
        timezone: settings.timezone || 'Africa/Cairo',
        date_format: settings.date_format || 'DD/MM/YYYY',
      });
    }
  };

  useEffect(() => {
    loadInitialSettings();
  }, [settings]);

  // Compute dirty state (has anything changed?)
  const isDirty = useMemo(() => {
    if (!settings) return false;
    return (
      form.store_name !== (settings.store_name || '') ||
      form.store_address !== (settings.store_address || '') ||
      form.store_phone !== (settings.store_phone || '') ||
      form.tax_id !== (settings.tax_id || '') ||
      form.currency_symbol !== (settings.currency_symbol || 'EGP') ||
      form.tax_rate !== (settings.tax_rate ? Number(settings.tax_rate) : 0) ||
      form.timezone !== (settings.timezone || 'Africa/Cairo') ||
      form.date_format !== (settings.date_format || 'DD/MM/YYYY')
    );
  }, [form, settings]);

  const handleDiscard = () => {
    loadInitialSettings();
    toast.success('Changes discarded');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form, {
      onSuccess: () => {
        toast.success('Settings saved successfully');
      },
      onError: () => {
        toast.error('Failed to save settings');
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl select-text pb-20 relative">
      <h3 className="text-base font-bold uppercase tracking-wider text-secondary mb-6 select-none">
        {t('settings.general')}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-8 select-text">
        {/* Company Details */}
        <div className="space-y-4 pb-6 border-b border-border">
          <h4 className="text-xs font-bold text-secondary uppercase tracking-wider select-none">
            {t('settings.companyDetails')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 select-none">
                {t('settings.storeName')}
              </label>
              <input
                type="text"
                className="w-full bg-neutral-900 border border-border rounded h-9 px-3 text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans select-text"
                value={form.store_name}
                onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 select-none">
                {t('settings.phone')}
              </label>
              <input
                type="text"
                className="w-full bg-neutral-900 border border-border rounded h-9 px-3 text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans select-text"
                value={form.store_phone}
                onChange={(e) => setForm({ ...form, store_phone: e.target.value })}
                placeholder={t('settings.placeholderPhone')}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 select-none">
                {t('settings.storeAddress')}
              </label>
              <textarea
                className="w-full bg-neutral-900 border border-border rounded p-3 text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans resize-none h-20 select-text"
                value={form.store_address}
                onChange={(e) => setForm({ ...form, store_address: e.target.value })}
                placeholder={t('settings.placeholderAddress')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 select-none">
                {t('settings.taxId')}
              </label>
              <input
                type="text"
                className="w-full bg-neutral-900 border border-border rounded h-9 px-3 text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans select-text"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                placeholder={t('settings.placeholderTaxId')}
              />
            </div>
          </div>
        </div>

        {/* Financial & Localization */}
        <div className="space-y-4 pb-6">
          <h4 className="text-xs font-bold text-secondary uppercase tracking-wider select-none">
            {t('settings.financialL10n')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 select-none">
                {t('settings.currencySymbol')}
              </label>
              <input
                type="text"
                className="w-full bg-neutral-900 border border-border rounded h-9 px-3 text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono select-text"
                value={form.currency_symbol}
                onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 select-none">
                {t('settings.defaultTax')} (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full bg-neutral-900 border border-border rounded h-9 px-3 text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono select-text"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 select-none">
                {t('settings.timezone')}
              </label>
              <div className="relative">
                <select
                  className="w-full bg-neutral-900 border border-border rounded h-9 px-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans appearance-none select-text"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                >
                  <option value="Africa/Cairo">Africa/Cairo</option>
                  <option value="Asia/Riyadh">Asia/Riyadh</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400">
                  ▼
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 select-none">
                {t('settings.dateFormat')}
              </label>
              <div className="relative">
                <select
                  className="w-full bg-neutral-900 border border-border rounded h-9 px-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono appearance-none select-text"
                  value={form.date_format}
                  onChange={(e) => setForm({ ...form, date_format: e.target.value })}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400">
                  ▼
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sticky Unsaved Changes Action Bar ── */}
        {isDirty && (
          <div className="sticky bottom-4 left-0 right-0 bg-neutral-950 border border-border rounded p-3.5 flex items-center justify-between shadow-2xl animate-fade-in z-20 select-none">
            <span className="text-xs font-semibold text-neutral-300">
              You have unsaved changes to your general settings
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDiscard}
                className="px-4 h-8 bg-transparent hover:bg-neutral-900 border border-border text-secondary hover:text-foreground text-[10px] font-bold uppercase tracking-wider rounded transition-colors focus:outline-none"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 h-8 bg-primary hover:bg-primary-600 text-white text-[10px] font-bold uppercase tracking-wider rounded transition-colors focus:outline-none disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default GeneralSettingsScreen;
