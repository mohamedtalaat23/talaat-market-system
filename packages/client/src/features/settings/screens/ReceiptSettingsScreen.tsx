import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../hooks/useSettingsQueries';
import { Spinner } from '@/components/ui/Spinner';
import { useTranslation } from '@/hooks/useTranslation';

export function ReceiptSettingsScreen() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useSettings();
  const { mutate: updateSettings, isPending } = useUpdateSettings();

  const [form, setForm] = useState({
    receipt_header_text: '',
    receipt_footer_text: '',
    auto_print: false,
    show_cashier_name: true,
    show_tax_breakdown: false,
    include_store_contact: true,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        receipt_header_text: settings.receipt_header_text || '',
        receipt_footer_text: settings.receipt_footer_text || '',
        auto_print: String(settings.auto_print) === 'true',
        show_cashier_name:
          settings.show_cashier_name !== undefined
            ? String(settings.show_cashier_name) === 'true'
            : true,
        show_tax_breakdown:
          settings.show_tax_breakdown !== undefined
            ? String(settings.show_tax_breakdown) === 'true'
            : false,
        include_store_contact:
          settings.include_store_contact !== undefined
            ? String(settings.include_store_contact) === 'true'
            : true,
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
        <h3 className="text-2xl font-black tracking-tight text-foreground">{t('settings.receipts')}</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-card/40 border border-border/60 rounded-2xl p-6 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] space-y-6">
          <div>
            <label className="block text-sm font-bold mb-3 text-foreground">{t('settings.receiptHeader')}</label>
            <textarea
              className="w-full h-32 bg-card border border-border/60 rounded-xl px-5 py-4 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none font-mono text-sm text-foreground shadow-sm transition-all"
              value={form.receipt_header_text}
              onChange={(e) => setForm({ ...form, receipt_header_text: e.target.value })}
              placeholder={t('settings.placeholderHeader')}
            />
            <p className="text-sm text-secondary/80 font-medium mt-3 leading-relaxed">{t('settings.receiptHeaderDesc')}</p>
          </div>

          <div className="pt-4 border-t border-border/40">
            <label className="block text-sm font-bold mb-3 text-foreground">{t('settings.receiptFooter')}</label>
            <textarea
              className="w-full h-32 bg-card border border-border/60 rounded-xl px-5 py-4 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none font-mono text-sm text-foreground shadow-sm transition-all"
              value={form.receipt_footer_text}
              onChange={(e) => setForm({ ...form, receipt_footer_text: e.target.value })}
              placeholder={t('settings.placeholderFooter')}
            />
            <p className="text-sm text-secondary/80 font-medium mt-3 leading-relaxed">{t('settings.receiptFooterDesc')}</p>
          </div>
        </div>

        <div className="space-y-5">
          <h4 className="text-xs font-black text-secondary uppercase tracking-widest pl-1">
            {t('settings.printingOptions')}
          </h4>

          <div className="bg-card/40 border border-border/60 rounded-2xl p-6 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-card transition-colors border border-transparent hover:border-border/40 group cursor-pointer" onClick={() => setForm({ ...form, auto_print: !form.auto_print })}>
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  id="auto_print"
                  className="w-5 h-5 rounded border-border/60 text-primary focus:ring-primary/20 bg-card cursor-pointer transition-all"
                  checked={form.auto_print}
                  onChange={(e) => setForm({ ...form, auto_print: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <label
                htmlFor="auto_print"
                className="select-none cursor-pointer w-full"
                onClick={(e) => e.preventDefault()}
              >
                <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {t('settings.autoPrint')}
                </div>
                <div className="text-sm text-secondary/80 font-medium mt-1 leading-relaxed">
                  {t('settings.autoPrintDesc')}
                </div>
              </label>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-card transition-colors border border-transparent hover:border-border/40 group cursor-pointer" onClick={() => setForm({ ...form, show_cashier_name: !form.show_cashier_name })}>
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  id="show_cashier_name"
                  className="w-5 h-5 rounded border-border/60 text-primary focus:ring-primary/20 bg-card cursor-pointer transition-all"
                  checked={form.show_cashier_name}
                  onChange={(e) => setForm({ ...form, show_cashier_name: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <label
                htmlFor="show_cashier_name"
                className="select-none cursor-pointer w-full"
                onClick={(e) => e.preventDefault()}
              >
                <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {t('settings.showCashierName')}
                </div>
                <div className="text-sm text-secondary/80 font-medium mt-1 leading-relaxed">
                  {t('settings.showCashierNameDesc')}
                </div>
              </label>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-card transition-colors border border-transparent hover:border-border/40 group cursor-pointer" onClick={() => setForm({ ...form, show_tax_breakdown: !form.show_tax_breakdown })}>
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  id="show_tax_breakdown"
                  className="w-5 h-5 rounded border-border/60 text-primary focus:ring-primary/20 bg-card cursor-pointer transition-all"
                  checked={form.show_tax_breakdown}
                  onChange={(e) => setForm({ ...form, show_tax_breakdown: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <label
                htmlFor="show_tax_breakdown"
                className="select-none cursor-pointer w-full"
                onClick={(e) => e.preventDefault()}
              >
                <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {t('settings.showTax')}
                </div>
                <div className="text-sm text-secondary/80 font-medium mt-1 leading-relaxed">
                  {t('settings.showTaxDesc')}
                </div>
              </label>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-card transition-colors border border-transparent hover:border-border/40 group cursor-pointer" onClick={() => setForm({ ...form, include_store_contact: !form.include_store_contact })}>
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  id="include_store_contact"
                  className="w-5 h-5 rounded border-border/60 text-primary focus:ring-primary/20 bg-card cursor-pointer transition-all"
                  checked={form.include_store_contact}
                  onChange={(e) => setForm({ ...form, include_store_contact: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <label
                htmlFor="include_store_contact"
                className="select-none cursor-pointer w-full"
                onClick={(e) => e.preventDefault()}
              >
                <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {t('settings.includeContact')}
                </div>
                <div className="text-sm text-secondary/80 font-medium mt-1 leading-relaxed">
                  {t('settings.includeContactDesc')}
                </div>
              </label>
            </div>
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
