import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../hooks/useSettingsQueries';
import { Spinner } from '@/components/ui/Spinner';
import { useTranslation } from '@/hooks/useTranslation';

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

  useEffect(() => {
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
  }, [settings]);

  if (isLoading)
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
  };

  return (
    <div className="max-w-2xl select-text">
      <h3 className="text-xl font-semibold mb-6">{t('settings.general')}</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Details */}
        <div className="space-y-4 pb-4 border-b border-border/50">
          <h4 className="text-sm font-medium text-secondary uppercase tracking-wider">
            {t('settings.companyDetails')}
          </h4>
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.storeName')}</label>
            <input
              type="text"
              className="w-full bg-input border border-border rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              value={form.store_name}
              onChange={(e) => setForm({ ...form, store_name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.storeAddress')}</label>
            <textarea
              className="w-full bg-input border border-border rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none h-20"
              value={form.store_address}
              onChange={(e) => setForm({ ...form, store_address: e.target.value })}
              placeholder={t('settings.placeholderAddress')}
            />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">{t('settings.phone')}</label>
              <input
                type="text"
                className="w-full bg-input border border-border rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.store_phone}
                onChange={(e) => setForm({ ...form, store_phone: e.target.value })}
                placeholder={t('settings.placeholderPhone')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('settings.taxId')}</label>
              <input
                type="text"
                className="w-full bg-input border border-border rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                placeholder={t('settings.placeholderTaxId')}
              />
            </div>
          </div>
        </div>

        {/* Financial & Localization */}
        <div className="space-y-4 pb-4 border-b border-border/50">
          <h4 className="text-sm font-medium text-secondary uppercase tracking-wider">
            {t('settings.financialL10n')}
          </h4>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('settings.currencySymbol')}
              </label>
              <input
                type="text"
                className="w-full bg-input border border-border rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.currency_symbol}
                onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('settings.defaultTax')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full bg-input border border-border rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('settings.timezone')}</label>
              <select
                className="w-full bg-input border border-border rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none"
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
            <div>
              <label className="block text-sm font-medium mb-2">{t('settings.dateFormat')}</label>
              <select
                className="w-full bg-input border border-border rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none"
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
        <div className="pt-4 border-t border-border">
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? t('settings.saving') : t('settings.saveChanges')}
          </button>
        </div>
      </form>
    </div>
  );
}
