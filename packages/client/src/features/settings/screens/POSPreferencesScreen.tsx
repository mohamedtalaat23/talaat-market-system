import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../hooks/useSettingsQueries';
import { Spinner } from '@/components/ui/Spinner';
import { useTranslation } from '@/hooks/useTranslation';

export function POSPreferencesScreen() {
  const { t } = useTranslation();
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
        allow_negative_inventory:
          settings.allow_negative_inventory !== undefined
            ? String(settings.allow_negative_inventory) === 'true'
            : false,
        require_manager_pin_voids:
          settings.require_manager_pin_voids !== undefined
            ? String(settings.require_manager_pin_voids) === 'true'
            : true,
        low_stock_threshold: settings.low_stock_threshold
          ? Number(settings.low_stock_threshold)
          : 10,
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
    <div className="max-w-3xl select-text space-y-8 pb-10">
      <div className="flex items-center gap-4 border-b border-border/40 pb-5">
        <h3 className="text-2xl font-black tracking-tight text-foreground">{t('settings.pos')}</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-5">
          <h4 className="text-xs font-black text-secondary uppercase tracking-widest pl-1">
            {t('settings.workflowSecurity')}
          </h4>

          <div className="bg-card/40 border border-border/60 rounded-2xl p-6 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-card transition-colors border border-transparent hover:border-border/40 group cursor-pointer" onClick={() => setForm({ ...form, allow_negative_inventory: !form.allow_negative_inventory })}>
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  id="allow_negative_inventory"
                  className="w-5 h-5 rounded border-border/60 text-primary focus:ring-primary/20 bg-card cursor-pointer transition-all"
                  checked={form.allow_negative_inventory}
                  onChange={(e) => setForm({ ...form, allow_negative_inventory: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <label
                htmlFor="allow_negative_inventory"
                className="select-none cursor-pointer w-full"
                onClick={(e) => e.preventDefault()}
              >
                <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {t('settings.allowNegative')}
                </div>
                <div className="text-sm text-secondary/80 font-medium mt-1 leading-relaxed">
                  {t('settings.allowNegativeDesc')}
                </div>
              </label>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-card transition-colors border border-transparent hover:border-border/40 group cursor-pointer" onClick={() => setForm({ ...form, require_manager_pin_voids: !form.require_manager_pin_voids })}>
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  id="require_manager_pin_voids"
                  className="w-5 h-5 rounded border-border/60 text-primary focus:ring-primary/20 bg-card cursor-pointer transition-all"
                  checked={form.require_manager_pin_voids}
                  onChange={(e) => setForm({ ...form, require_manager_pin_voids: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <label
                htmlFor="require_manager_pin_voids"
                className="select-none cursor-pointer w-full"
                onClick={(e) => e.preventDefault()}
              >
                <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {t('settings.requireManagerPin')}
                </div>
                <div className="text-sm text-secondary/80 font-medium mt-1 leading-relaxed">
                  {t('settings.requireManagerPinDesc')}
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h4 className="text-xs font-black text-secondary uppercase tracking-widest pl-1">
            {t('settings.alertsNotifications')}
          </h4>

          <div className="bg-card/40 border border-border/60 rounded-2xl p-6 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
            <label className="block text-sm font-bold mb-3 text-foreground">
              {t('settings.defaultLowStockThreshold')}
            </label>
            <input
              type="number"
              min="0"
              className="w-full bg-card border border-border/60 rounded-xl px-4 py-3.5 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none max-w-xs text-foreground font-bold shadow-sm transition-all"
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })}
            />
            <p className="text-sm text-secondary/80 font-medium mt-3 leading-relaxed max-w-xl">{t('settings.defaultLowStockDesc')}</p>
          </div>
        </div>

        <div className="pt-6 border-t border-border/40 flex">
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-bold tracking-wide hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5"
          >
            {isPending ? t('settings.saving') : t('settings.saveChanges')}
          </button>
        </div>
      </form>
    </div>
  );
}
