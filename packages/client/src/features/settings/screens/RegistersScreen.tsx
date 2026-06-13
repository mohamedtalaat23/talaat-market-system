import { Store } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import toast from 'react-hot-toast';

export function RegistersScreen() {
  const { t } = useTranslation();

  return (
    <div className="max-w-5xl select-text space-y-8 pb-10">
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <h3 className="text-2xl font-black tracking-tight text-foreground">{t('settings.registers')}</h3>
        <button
          onClick={() => toast('Register management is coming in a future update.', { icon: '🏗️' })}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 tracking-wide"
        >
          {t('settings.addRegister')}
        </button>
      </div>

      <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm shadow-black/5">
        <table className="w-full text-sm text-start">
          <thead className="bg-muted/40 backdrop-blur-md border-b border-border/60 text-secondary">
            <tr>
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-start">{t('settings.registerName')}</th>
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-start">{t('common.status')}</th>
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-center">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {/* Placeholder data since we don't have a CRUD endpoint for registers yet */}
            <tr className="group hover:bg-primary/[0.02] transition-colors">
              <td className="px-6 py-5 font-bold flex items-center gap-4 text-foreground">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm group-hover:scale-105 transition-transform">
                  <Store size={18} />
                </div>
                <span>Main Register 01</span>
              </td>
              <td className="px-6 py-5">
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black bg-success/10 text-success border border-success/20 uppercase tracking-widest">
                  {t('products.active')}
                </span>
              </td>
              <td className="px-6 py-5 text-center">
                <button
                  onClick={() => toast('Register editing is coming in a future update.', { icon: '🏗️' })}
                  className="bg-card hover:bg-primary/5 text-secondary hover:text-primary border border-border/60 hover:border-primary/30 rounded-lg transition-all text-xs font-bold px-4 py-2 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                >
                  {t('common.edit')}
                </button>
              </td>
            </tr>
            <tr className="group hover:bg-primary/[0.02] transition-colors">
              <td className="px-6 py-5 font-bold flex items-center gap-4 text-foreground">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm group-hover:scale-105 transition-transform">
                  <Store size={18} />
                </div>
                <span>Backup Register 02</span>
              </td>
              <td className="px-6 py-5">
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black bg-success/10 text-success border border-success/20 uppercase tracking-widest">
                  {t('products.active')}
                </span>
              </td>
              <td className="px-6 py-5 text-center">
                <button
                  onClick={() => toast('Register editing is coming in a future update.', { icon: '🏗️' })}
                  className="bg-card hover:bg-primary/5 text-secondary hover:text-primary border border-border/60 hover:border-primary/30 rounded-lg transition-all text-xs font-bold px-4 py-2 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                >
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
