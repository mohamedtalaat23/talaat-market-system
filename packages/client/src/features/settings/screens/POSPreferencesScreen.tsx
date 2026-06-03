import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../hooks/useSettingsQueries';
import { Spinner } from '@/components/ui/Spinner';

export function POSPreferencesScreen() {
  const { data: settings, isLoading } = useSettings();
  const { mutate: updateSettings, isPending } = useUpdateSettings();

  const [form, setForm] = useState({
    allow_negative_inventory: false,
    require_manager_pin_voids: true,
    low_stock_threshold: 10,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        allow_negative_inventory: settings.allow_negative_inventory !== undefined ? String(settings.allow_negative_inventory) === 'true' : false,
        require_manager_pin_voids: settings.require_manager_pin_voids !== undefined ? String(settings.require_manager_pin_voids) === 'true' : true,
        low_stock_threshold: settings.low_stock_threshold ? Number(settings.low_stock_threshold) : 10,
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
      <h3 className="text-xl font-semibold mb-6">POS Preferences</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-secondary uppercase tracking-wider">Workflow & Security</h4>
          
          <div className="flex items-center space-x-3 bg-card-hover/40 p-4 rounded-lg border border-border">
            <input
              type="checkbox"
              id="allow_negative_inventory"
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-input"
              checked={form.allow_negative_inventory}
              onChange={(e) => setForm({ ...form, allow_negative_inventory: e.target.checked })}
            />
            <label htmlFor="allow_negative_inventory" className="text-sm font-medium select-none cursor-pointer w-full">
              Allow Negative Inventory
              <span className="block text-xs text-neutral-500 font-normal mt-0.5">Let cashiers sell out-of-stock items. Inventory levels will go below zero.</span>
            </label>
          </div>

          <div className="flex items-center space-x-3 bg-card-hover/40 p-4 rounded-lg border border-border">
            <input
              type="checkbox"
              id="require_manager_pin_voids"
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-input"
              checked={form.require_manager_pin_voids}
              onChange={(e) => setForm({ ...form, require_manager_pin_voids: e.target.checked })}
            />
            <label htmlFor="require_manager_pin_voids" className="text-sm font-medium select-none cursor-pointer w-full">
              Require Manager PIN for Voids
              <span className="block text-xs text-neutral-500 font-normal mt-0.5">Require an authorized manager PIN when voiding transactions or removing items from the cart.</span>
            </label>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h4 className="text-sm font-medium text-secondary uppercase tracking-wider">Alerts & Notifications</h4>
          
          <div>
            <label className="block text-sm font-medium mb-2">Default Low Stock Threshold</label>
            <input
              type="number"
              min="0"
              className="w-full bg-input border border-border rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none max-w-xs"
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })}
            />
            <p className="text-xs text-neutral-500 mt-1">Products will trigger a low stock alert when their quantity falls below this number (unless overridden on the product itself).</p>
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
