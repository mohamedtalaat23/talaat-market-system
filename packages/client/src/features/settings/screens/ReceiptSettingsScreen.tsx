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
    <div className="max-w-2xl select-text">
      <h3 className="text-xl font-semibold mb-6">{t('settings.receipts')}</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">{t('settings.receiptHeader')}</label>
          <textarea
            className="w-full h-24 bg-input-bg border border-input-border rounded-lg px-4 py-2 focus:border-input-focus focus:ring-primary/20 outline-none resize-none font-mono text-sm text-input-text placeholder:text-input-placeholder"
            value={form.receipt_header_text}
            onChange={(e) => setForm({ ...form, receipt_header_text: e.target.value })}
            placeholder={t('settings.placeholderHeader')}
          />
          <p className="text-xs text-neutral-500 mt-1">{t('settings.receiptHeaderDesc')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">{t('settings.receiptFooter')}</label>
          <textarea
            className="w-full h-24 bg-input-bg border border-input-border rounded-lg px-4 py-2 focus:border-input-focus focus:ring-primary/20 outline-none resize-none font-mono text-sm text-input-text placeholder:text-input-placeholder"
            value={form.receipt_footer_text}
            onChange={(e) => setForm({ ...form, receipt_footer_text: e.target.value })}
            placeholder={t('settings.placeholderFooter')}
          />
          <p className="text-xs text-neutral-500 mt-1">{t('settings.receiptFooterDesc')}</p>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-secondary uppercase tracking-wider mb-2">
            {t('settings.printingOptions')}
          </h4>

          <div className="flex items-center gap-3 bg-card-hover/40 p-4 rounded-lg border border-input-border">
            <input
              type="checkbox"
              id="auto_print"
              className="w-4 h-4 rounded border-input-border text-input-text focus:ring-primary/20 bg-input-bg placeholder:text-input-placeholder"
              checked={form.auto_print}
              onChange={(e) => setForm({ ...form, auto_print: e.target.checked })}
            />
            <label
              htmlFor="auto_print"
              className="text-sm font-medium select-none cursor-pointer w-full"
            >
              {t('settings.autoPrint')}
              <span className="block text-xs text-neutral-500 font-normal mt-0.5">
                {t('settings.autoPrintDesc')}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 bg-card-hover/40 p-4 rounded-lg border border-input-border">
            <input
              type="checkbox"
              id="show_cashier_name"
              className="w-4 h-4 rounded border-input-border text-input-text focus:ring-primary/20 bg-input-bg placeholder:text-input-placeholder"
              checked={form.show_cashier_name}
              onChange={(e) => setForm({ ...form, show_cashier_name: e.target.checked })}
            />
            <label
              htmlFor="show_cashier_name"
              className="text-sm font-medium select-none cursor-pointer w-full"
            >
              {t('settings.showCashierName')}
              <span className="block text-xs text-neutral-500 font-normal mt-0.5">
                {t('settings.showCashierNameDesc')}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 bg-card-hover/40 p-4 rounded-lg border border-input-border">
            <input
              type="checkbox"
              id="show_tax_breakdown"
              className="w-4 h-4 rounded border-input-border text-input-text focus:ring-primary/20 bg-input-bg placeholder:text-input-placeholder"
              checked={form.show_tax_breakdown}
              onChange={(e) => setForm({ ...form, show_tax_breakdown: e.target.checked })}
            />
            <label
              htmlFor="show_tax_breakdown"
              className="text-sm font-medium select-none cursor-pointer w-full"
            >
              {t('settings.showTax')}
              <span className="block text-xs text-neutral-500 font-normal mt-0.5">
                {t('settings.showTaxDesc')}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 bg-card-hover/40 p-4 rounded-lg border border-input-border">
            <input
              type="checkbox"
              id="include_store_contact"
              className="w-4 h-4 rounded border-input-border text-input-text focus:ring-primary/20 bg-input-bg placeholder:text-input-placeholder"
              checked={form.include_store_contact}
              onChange={(e) => setForm({ ...form, include_store_contact: e.target.checked })}
            />
            <label
              htmlFor="include_store_contact"
              className="text-sm font-medium select-none cursor-pointer w-full"
            >
              {t('settings.includeContact')}
              <span className="block text-xs text-neutral-500 font-normal mt-0.5">
                {t('settings.includeContactDesc')}
              </span>
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-input-border">
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
