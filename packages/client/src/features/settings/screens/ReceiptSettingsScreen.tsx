import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../hooks/useSettingsQueries';
import { Spinner } from '@/components/ui/Spinner';

export function ReceiptSettingsScreen() {
  const { data: settings, isLoading } = useSettings();
  const { mutate: updateSettings, isPending } = useUpdateSettings();

  const [form, setForm] = useState({
    receipt_header_text: '',
    receipt_footer_text: '',
    auto_print: false,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        receipt_header_text: settings.receipt_header_text || '',
        receipt_footer_text: settings.receipt_footer_text || '',
        auto_print: String(settings.auto_print) === 'true',
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
      <h3 className="text-xl font-semibold mb-6">Receipt Template</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Receipt Header Text</label>
          <textarea
            className="w-full h-24 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none font-mono text-sm"
            value={form.receipt_header_text}
            onChange={(e) => setForm({ ...form, receipt_header_text: e.target.value })}
            placeholder="Talaat Market\nMain Branch"
          />
          <p className="text-xs text-neutral-500 mt-1">Printed at the top of every receipt. Supports multiple lines.</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Receipt Footer Text</label>
          <textarea
            className="w-full h-24 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none font-mono text-sm"
            value={form.receipt_footer_text}
            onChange={(e) => setForm({ ...form, receipt_footer_text: e.target.value })}
            placeholder="Thank you for shopping with us!"
          />
          <p className="text-xs text-neutral-500 mt-1">Printed at the bottom of every receipt.</p>
        </div>

        <div className="flex items-center space-x-3 bg-neutral-900/50 p-4 rounded-lg border border-border">
          <input
            type="checkbox"
            id="auto_print"
            className="w-4 h-4 rounded border-neutral-700 text-primary focus:ring-primary bg-neutral-950"
            checked={form.auto_print}
            onChange={(e) => setForm({ ...form, auto_print: e.target.checked })}
          />
          <label htmlFor="auto_print" className="text-sm font-medium select-none cursor-pointer">
            Enable Auto-Print
            <span className="block text-xs text-neutral-500 font-normal mt-0.5">Skip the preview dialog and print receipts immediately after checkout.</span>
          </label>
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
