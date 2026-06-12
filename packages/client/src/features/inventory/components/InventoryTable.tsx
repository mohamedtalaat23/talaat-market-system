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
      <div className="flex flex-col items-center justify-center text-center p-12 border border-border bg-white rounded-md">
        <ShieldAlert className="h-10 w-10 text-neutral-500 mb-3" />
        <h3 className="text-sm font-bold text-foreground">{t('inventory.noStockMatches')}</h3>
        <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
          {t('inventory.noStockMatchesDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-border bg-white select-none rounded-md">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs text-foreground border-collapse">
          <thead className="sticky top-0 bg-neutral-100 border-b border-border text-secondary font-bold uppercase tracking-wider text-xs select-none">
            <tr className="h-9">
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
          <tbody className="divide-y divide-[#1F1F1F] select-text">
            {items.map((item) => {
              const qty = item.quantity;
              const isLow = qty <= item.product_min_stock_level;
              return (
                <tr
                  key={item.id}
                  className="h-9 hover:bg-neutral-50 bg-white text-foreground transition-all duration-fast select-text"
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
                        className="h-6 px-2.5 bg-neutral-100 hover:bg-neutral-200 text-secondary hover:text-foreground text-xs font-bold uppercase tracking-wider border border-border rounded transition-colors flex items-center gap-1 focus:outline-none"
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
