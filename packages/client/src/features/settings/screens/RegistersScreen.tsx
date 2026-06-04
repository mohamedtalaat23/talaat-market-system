import { Store } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export function RegistersScreen() {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl select-text">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">{t('settings.registers')}</h3>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          {t('settings.addRegister')}
        </button>
      </div>

      <div className="bg-input border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm text-start">
          <thead className="bg-card-hover border-b border-border text-secondary">
            <tr>
              <th className="px-6 py-3 font-medium text-start">{t('settings.registerName')}</th>
              <th className="px-6 py-3 font-medium text-start">{t('common.status')}</th>
              <th className="px-6 py-3 font-medium text-end">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* Placeholder data since we don't have a CRUD endpoint for registers yet */}
            <tr className="hover:bg-card-hover/40">
              <td className="px-6 py-4 font-medium flex items-center gap-3">
                <Store size={16} className="text-neutral-500" />
                <span>Main Register 01</span>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
                  {t('products.active')}
                </span>
              </td>
              <td className="px-6 py-4 text-end">
                <button className="text-primary hover:underline font-medium text-sm">
                  {t('common.edit')}
                </button>
              </td>
            </tr>
            <tr className="hover:bg-card-hover/40">
              <td className="px-6 py-4 font-medium flex items-center gap-3">
                <Store size={16} className="text-neutral-500" />
                <span>Backup Register 02</span>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
                  {t('products.active')}
                </span>
              </td>
              <td className="px-6 py-4 text-end">
                <button className="text-primary hover:underline font-medium text-sm">
                  {t('common.edit')}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
