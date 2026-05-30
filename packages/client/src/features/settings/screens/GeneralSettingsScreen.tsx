import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../hooks/useSettingsQueries';
import { Spinner } from '@/components/ui/Spinner';

export function GeneralSettingsScreen() {
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

  if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
  };

  return (
    <div className="max-w-2xl">
      <h3 className="text-xl font-semibold mb-6">General Settings</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Details */}
        <div className="space-y-4 pb-4 border-b border-border/50">
          <h4 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Company Details</h4>
          <div>
            <label className="block text-sm font-medium mb-2">Store Name</label>
            <input
              type="text"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              value={form.store_name}
              onChange={(e) => setForm({ ...form, store_name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Store Address</label>
            <textarea
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none h-20"
              value={form.store_address}
              onChange={(e) => setForm({ ...form, store_address: e.target.value })}
              placeholder="123 Main St, City, Country"
            />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Phone Number</label>
              <input
                type="text"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.store_phone}
                onChange={(e) => setForm({ ...form, store_phone: e.target.value })}
                placeholder="+20 123 456 7890"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tax ID / Commercial Register</label>
              <input
                type="text"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                placeholder="XXX-XXX-XXX"
              />
            </div>
          </div>
        </div>

        {/* Financial & Localization */}
        <div className="space-y-4 pb-4 border-b border-border/50">
          <h4 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Financial & Localization</h4>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Currency Symbol</label>
              <input
                type="text"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.currency_symbol}
                onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Default Tax Rate (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">Timezone</label>
              <select
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              >
                <option value="Africa/Cairo">Africa/Cairo</option>
                <option value="Asia/Riyadh">Asia/Riyadh</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
                {/* Add more timezones as needed */}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Date Format</label>
              <select
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none"
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
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
