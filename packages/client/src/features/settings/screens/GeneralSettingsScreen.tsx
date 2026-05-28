import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../hooks/useSettingsQueries';
import { Spinner } from '@/components/ui/Spinner';

export function GeneralSettingsScreen() {
  const { data: settings, isLoading } = useSettings();
  const { mutate: updateSettings, isPending } = useUpdateSettings();

  const [form, setForm] = useState({
    store_name: '',
    currency_symbol: 'EGP',
    tax_rate: 0,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        store_name: settings.store_name || '',
        currency_symbol: settings.currency_symbol || 'EGP',
        tax_rate: settings.tax_rate ? Number(settings.tax_rate) : 0,
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
