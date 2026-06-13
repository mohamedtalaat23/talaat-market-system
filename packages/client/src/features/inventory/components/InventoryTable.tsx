import { ShieldAlert, Barcode, ArrowUpDown } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { InventoryItem } from '../hooks/useInventoryQueries';
import { InventoryTableSkeleton } from './InventoryTableSkeleton';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { format } from 'date-fns';

interface InventoryTableProps {
  items: InventoryItem[];
  onAdjust: (item: InventoryItem) => void;
  isLoading: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}

export function InventoryTable({
  items,
  onAdjust,
  isLoading,
  sortBy,
  sortOrder,
  onSort,
}: InventoryTableProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <InventoryTableSkeleton rows={10} />;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-16 border border-border/40 bg-white/60 dark:bg-card/60 backdrop-blur-md rounded-2xl shadow-sm">
        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <ShieldAlert className="h-8 w-8 text-neutral-400" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">{t('inventory.noStockMatches')}</h3>
        <p className="text-sm text-secondary leading-relaxed max-w-sm">
          {t('inventory.noStockMatchesDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-border/40 bg-white/60 dark:bg-card/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-2xl">
      <div className="table-container">
        <table className="w-full text-start text-xs text-foreground border-collapse">
          <thead className="bg-neutral-50/80 dark:bg-neutral-900/80 text-secondary font-bold uppercase tracking-wider text-[11px] select-none shadow-sm z-10">
            <tr className="table-header-sticky h-11 border-b border-border/50">
              <th className="py-2 px-3 text-start font-semibold">{t('inventory.productDetail')}</th>
              <th className="py-2 px-3 text-start font-semibold">{t('products.barcodePLU')}</th>
              <SortableHeader
                label={t('products.costPrice')}
                field="cost"
                align="end"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort || (() => {})}
                className="text-xs uppercase tracking-wider px-3"
              />
              <SortableHeader
                label={t('inventory.inStockCount')}
                field="stock"
                align="end"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort || (() => {})}
                className="text-xs uppercase tracking-wider px-3"
              />
              <SortableHeader
                label={t('inventory.lastUpdated') || 'Last Updated'}
                field="lastUpdated"
                align="end"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort || (() => {})}
                className="text-xs uppercase tracking-wider px-3"
              />
              <th className="py-2 px-3 text-center font-semibold">{t('common.status')}</th>
              <th className="py-2 px-3 text-center font-semibold">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 select-text">
            {items.map((item) => {
              const qty = item.quantity;
              const isLow = qty <= item.product_min_stock_level;
              return (
                <tr
                  key={item.id}
                  className="table-row-hover h-12 hover:bg-primary/5 transition-colors duration-200 select-text group"
                >
                  <td className="py-1.5 px-3 select-text">
                    <div className="flex flex-col justify-center select-all">
                      <span className="font-sans font-medium text-sm text-foreground leading-normal truncate max-w-[200px]" title={item.product_name}>
                        {item.product_name}
                      </span>
                      {item.product_name_ar && (
                        <span className="text-xs text-secondary font-arabic leading-tight select-all truncate max-w-[200px]" title={item.product_name_ar}>
                          {item.product_name_ar}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 px-3 font-mono text-secondary select-text">
                    {item.product_barcode ? (
                      <div className="flex items-center gap-1.5 select-all">
                        <Barcode size={13} className="text-neutral-600" />
                        <span>{item.product_barcode}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-600 italic select-none">
                        {t('inventory.looseProduce')}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 text-end font-mono tabular-nums text-secondary select-all">
                    EGP {item.product_cost_price?.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-3 text-end font-mono tabular-nums select-all">
                    <div className="flex flex-col items-end justify-center">
                      <span
                        className={`font-semibold ${isLow ? 'text-danger font-bold' : 'text-foreground'}`}
                      >
                        {qty} {item.product_unit}
                      </span>
                      <span className="text-xs text-neutral-500">
                        Min: {item.product_min_stock_level}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 px-3 text-end font-mono tabular-nums text-secondary select-all text-xs">
                    {format(new Date(item.updated_at), 'dd MMM, HH:mm')}
                  </td>
                  <td className="py-1.5 px-3 text-center select-none">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-danger/10 border border-danger/20 text-danger uppercase tracking-wider">
                        <ShieldAlert size={10} />
                        <span>{t('inventory.restock')}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-success/10 border border-success/20 text-success uppercase tracking-wider">
                        <span>{t('inventory.ok')}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 select-none">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => onAdjust(item)}
                        className="h-8 px-3 bg-white dark:bg-card hover:bg-primary/5 text-secondary hover:text-primary text-[10px] font-black uppercase tracking-widest border border-border/60 hover:border-primary/40 rounded-lg transition-all duration-300 flex items-center gap-1.5 focus:outline-none hover:-translate-y-0.5 shadow-sm hover:shadow-md opacity-70 group-hover:opacity-100"
                      >
                        <ArrowUpDown size={12} />
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
