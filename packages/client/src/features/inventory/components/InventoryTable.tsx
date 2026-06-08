import { ShieldAlert, Barcode, ArrowUpDown } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { InventoryItem } from '../hooks/useInventoryQueries';

interface InventoryTableProps {
  items: InventoryItem[];
  onAdjust: (item: InventoryItem) => void;
  isLoading: boolean;
}

export function InventoryTable({ items, onAdjust, isLoading }: InventoryTableProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex h-40 w-full items-center justify-center border border-border bg-neutral-900">
        <span className="text-xs text-neutral-500 font-mono">{t('inventory.fetchingLedger')}</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 border border-border bg-neutral-900">
        <ShieldAlert className="h-10 w-10 text-neutral-500 mb-3" />
        <h3 className="text-sm font-bold text-foreground">{t('inventory.noStockMatches')}</h3>
        <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
          {t('inventory.noStockMatchesDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-border bg-neutral-900 select-none">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs text-foreground border-collapse">
          <thead className="sticky top-0 bg-neutral-950 border-b border-border text-secondary font-bold uppercase tracking-wider text-[10px] select-none">
            <tr className="h-9">
              <th className="px-4 text-start font-semibold">{t('inventory.productDetail')}</th>
              <th className="px-4 text-start font-semibold">{t('products.barcodePLU')}</th>
              <th className="px-4 text-end font-semibold">{t('products.sellingPrice')}</th>
              <th className="px-4 text-end font-semibold">{t('inventory.warningLimit')}</th>
              <th className="px-4 text-end font-semibold">{t('inventory.inStockCount')}</th>
              <th className="px-4 text-center font-semibold">{t('common.status')}</th>
              <th className="px-4 text-center font-semibold">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F1F1F] select-text">
            {items.map((item) => {
              const qty = item.quantity;
              const isLow = qty <= item.product_min_stock_level;
              return (
                <tr
                  key={item.id}
                  className="h-9 hover:bg-neutral-850/50 bg-transparent text-foreground transition-all duration-fast select-text"
                >
                  <td className="px-4 py-1 select-text">
                    <div className="flex flex-col justify-center select-all">
                      <span className="font-sans font-medium text-sm text-foreground leading-normal">
                        {item.product_name}
                      </span>
                      {item.product_name_ar && (
                        <span className="text-[10px] text-secondary font-arabic leading-tight select-all">
                          {item.product_name_ar}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-1 font-mono text-secondary select-text">
                    {item.product_barcode ? (
                      <div className="flex items-center gap-1.5 select-all">
                        <Barcode size={13} className="text-neutral-600" />
                        <span>{item.product_barcode}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-neutral-600 italic select-none">
                        {t('inventory.looseProduce')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-1 text-end font-mono text-secondary select-all">
                    EGP {item.product_selling_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-1 text-end font-mono text-secondary select-all">
                    {item.product_min_stock_level} {item.product_unit}
                  </td>
                  <td className="px-4 py-1 text-end font-mono select-all">
                    <div className="flex flex-col items-end justify-center">
                      <span
                        className={`font-semibold ${isLow ? 'text-danger font-bold' : 'text-foreground'}`}
                      >
                        {qty} {item.product_unit}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-1 text-center select-none">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger/10 border border-danger/20 text-danger uppercase tracking-wider">
                        <ShieldAlert size={10} />
                        <span>{t('inventory.restock')}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/10 border border-success/20 text-success uppercase tracking-wider">
                        <span>{t('inventory.ok')}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-1 select-none">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => onAdjust(item)}
                        className="h-6 px-2.5 bg-neutral-800 hover:bg-neutral-750 text-secondary hover:text-foreground text-[10px] font-bold uppercase tracking-wider border border-border rounded transition-colors flex items-center gap-1 focus:outline-none"
                      >
                        <ArrowUpDown size={11} />
                        <span>{t('inventory.adjustStock')}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
