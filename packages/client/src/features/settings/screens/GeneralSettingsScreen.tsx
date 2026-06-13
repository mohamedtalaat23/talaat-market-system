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
    <div className="max-w-4xl select-text pb-24 relative">
      <h3 className="text-2xl font-black tracking-tight text-foreground mb-8 select-none">
        {t('settings.general')}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-10 select-text">
        {/* Company Details */}
        <div className="space-y-6 pb-8 border-b border-border/40">
          <h4 className="text-[11px] font-black text-primary uppercase tracking-widest select-none bg-primary/10 w-max px-3 py-1.5 rounded-md">
            {t('settings.companyDetails')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-foreground/80 tracking-wider uppercase select-none">
                {t('settings.storeName')}
              </label>
              <input
                type="text"
                className="w-full bg-background border border-border/60 rounded-xl h-12 px-4 text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-semibold"
                value={form.store_name}
                onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-foreground/80 tracking-wider uppercase select-none">
                {t('settings.phone')}
              </label>
              <input
                type="text"
                className="w-full bg-background border border-border/60 rounded-xl h-12 px-4 text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-semibold"
                value={form.store_phone}
                onChange={(e) => setForm({ ...form, store_phone: e.target.value })}
                placeholder={t('settings.placeholderPhone')}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-bold text-foreground/80 tracking-wider uppercase select-none">
                {t('settings.storeAddress')}
              </label>
              <textarea
                className="w-full bg-background border border-border/60 rounded-xl p-4 text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-semibold resize-none h-24"
                value={form.store_address}
                onChange={(e) => setForm({ ...form, store_address: e.target.value })}
                placeholder={t('settings.placeholderAddress')}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-foreground/80 tracking-wider uppercase select-none">
                {t('settings.taxId')}
              </label>
              <input
                type="text"
                className="w-full bg-background border border-border/60 rounded-xl h-12 px-4 text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-semibold"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                placeholder={t('settings.placeholderTaxId')}
              />
            </div>
          </div>
        </div>

        {/* Financial & Localization */}
        <div className="space-y-6 pb-6">
          <h4 className="text-[11px] font-black text-primary uppercase tracking-widest select-none bg-primary/10 w-max px-3 py-1.5 rounded-md">
            {t('settings.financialL10n')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-foreground/80 tracking-wider uppercase select-none">
                {t('settings.currencySymbol')}
              </label>
              <input
                type="text"
                className="w-full bg-background border border-border/60 rounded-xl h-12 px-4 text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-mono font-bold"
                value={form.currency_symbol}
                onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-foreground/80 tracking-wider uppercase select-none">
                {t('settings.defaultTax')} (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full bg-background border border-border/60 rounded-xl h-12 px-4 text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-mono font-bold"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-foreground/80 tracking-wider uppercase select-none">
                {t('settings.timezone')}
              </label>
              <select
                className="w-full bg-background border border-border/60 rounded-xl h-12 px-4 text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-semibold appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 1rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              >
                <option value="Africa/Cairo">Africa/Cairo</option>
                <option value="Asia/Riyadh">Asia/Riyadh</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-foreground/80 tracking-wider uppercase select-none">
                {t('settings.dateFormat')}
              </label>
              <select
                className="w-full bg-background border border-border/60 rounded-xl h-12 px-4 text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-mono font-bold appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 1rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                value={form.date_format}
                onChange={(e) => setForm({ ...form, date_format: e.target.value })}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Sticky Unsaved Changes Action Bar ── */}
        {isDirty && (
          <div className="sticky bottom-6 left-0 right-0 bg-white/95 dark:bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.7)] animate-in slide-in-from-bottom-8 duration-300 z-20 select-none gap-4">
            <span className="text-sm font-bold text-foreground">
              You have unsaved changes to your general settings
            </span>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDiscard}
                className="flex-1 sm:flex-none px-6 py-3 bg-white dark:bg-card hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-border/60 text-secondary hover:text-foreground text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm focus:outline-none"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all focus:outline-none disabled:opacity-50 shadow-[0_4px_14px_rgba(var(--color-primary-500),0.3)] hover:shadow-[0_6px_20px_rgba(var(--color-primary-500),0.4)] hover:-translate-y-0.5 active:scale-95"
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
