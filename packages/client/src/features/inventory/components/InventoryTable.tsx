import { ShieldAlert, Barcode, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { InventoryItem } from '../hooks/useInventoryQueries';

interface InventoryTableProps {
  items: InventoryItem[];
  onAdjust: (item: InventoryItem) => void;
  isLoading: boolean;
}

export function InventoryTable({ items, onAdjust, isLoading }: InventoryTableProps) {
  if (isLoading) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-lg border border-border bg-card-hover/30">
        <span className="text-sm text-secondary font-mono">Fetching stock ledger...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 border border-border rounded-lg bg-card-hover/30">
        <ShieldAlert className="h-10 w-10 text-neutral-500 mb-3" />
        <h3 className="text-base font-semibold text-foreground">No Stock Matches</h3>
        <p className="text-sm text-secondary mt-2 leading-relaxed">
          No inventory stock listings match your search terms or active category filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-foreground">
          <thead className="bg-card-hover border-b border-border text-secondary font-semibold select-none">
            <tr>
              <th className="p-4 font-medium">Product Detail</th>
              <th className="p-4 font-medium">Barcode / SKU</th>
              <th className="p-4 font-medium text-right">Selling Price</th>
              <th className="p-4 font-medium text-right">Warning Stock Limit</th>
              <th className="p-4 font-medium text-right">In-Stock Count</th>
              <th className="p-4 font-medium text-center">Status</th>
              <th className="p-4 font-medium text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border select-text">
            {items.map((item) => {
              const qty = item.quantity;
              const isLow = qty <= item.product_min_stock_level;
              return (
                <tr key={item.id} className="hover:bg-card-hover/40 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-foreground leading-tight">{item.product_name}</div>
                    {item.product_name_ar && (
                      <div className="text-xs text-secondary font-arabic mt-0.5 text-right md:text-left select-all">
                        {item.product_name_ar}
                      </div>
                    )}
                    <span className="inline-block text-[10px] text-secondary bg-card-hover px-2 py-0.5 rounded border border-border mt-1 uppercase font-semibold">
                      {item.category_name || 'General Catalog'}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-foreground">
                    {item.product_barcode ? (
                      <div className="flex items-center space-x-1.5 select-all">
                        <Barcode size={14} className="text-neutral-500" />
                        <span>{item.product_barcode}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-500">Loose / Weighed Produce</span>
                    )}
                  </td>
                  <td className="p-4 text-right font-mono text-secondary">
                    EGP {item.product_selling_price.toFixed(2)}
                  </td>
                  <td className="p-4 text-right font-mono text-secondary">
                    {item.product_min_stock_level} {item.product_unit}
                  </td>
                  <td className="p-4 text-right font-mono">
                    <div className="flex flex-col items-end">
                      <span className={`font-semibold ${isLow ? 'text-destructive font-bold' : 'text-foreground'}`}>
                        {qty} {item.product_unit}
                      </span>
                      {isLow && (
                        <span className="flex items-center space-x-0.5 text-[9px] text-destructive uppercase tracking-wider mt-0.5 font-bold">
                          <ShieldAlert size={10} />
                          <span>LOW STOCK</span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {isLow ? (
                      <Badge variant="destructive">Restock</Badge>
                    ) : (
                      <Badge variant="success">OK</Badge>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center">
                      <Button
                        onClick={() => onAdjust(item)}
                        variant="secondary"
                        size="sm"
                        className="h-8 font-semibold flex items-center space-x-1.5"
                      >
                        <ArrowUpDown size={13} />
                        <span>Adjust Stock</span>
                      </Button>
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
