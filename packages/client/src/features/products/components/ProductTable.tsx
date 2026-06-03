import { Barcode, Edit2, Trash2, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Product } from '../hooks/useProductQueries';

interface ProductTableProps {
  products: Product[];
  isLoading: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onClearFilters: () => void;
  hasFilters: boolean;
}

export function ProductTable({
  products,
  isLoading,
  onEdit,
  onDelete,
  onClearFilters,
  hasFilters,
}: ProductTableProps) {
  return (
    <Card className="overflow-hidden border-border" role="region" aria-label="Product Catalog Table">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-foreground" role="table">
          <caption className="sr-only">List of store products with names, prices, and stock indicators</caption>
          <thead className="bg-card-hover border-b border-border text-secondary font-semibold select-none">
            <tr>
              <th scope="col" className="p-4 font-medium">Product Name / Description</th>
              <th scope="col" className="p-4 font-medium">Barcode</th>
              <th scope="col" className="p-4 font-medium">Category</th>
              <th scope="col" className="p-4 font-medium text-right">Cost Price</th>
              <th scope="col" className="p-4 font-medium text-right">Selling Price</th>
              <th scope="col" className="p-4 font-medium text-right">Stock Qty</th>
              <th scope="col" className="p-4 font-medium text-center">Status</th>
              <th scope="col" className="p-4 font-medium text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border select-text">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-secondary font-medium">
                  Refreshing products...
                </td>
              </tr>
            ) : products.length > 0 ? (
              products.map((product) => {
                const qty = product.inventory_quantity ?? 0;
                const isLow = qty <= product.min_stock_level;
                return (
                  <tr key={product.id} className="hover:bg-card-hover/40 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-foreground leading-tight">{product.name}</div>
                      {product.name_ar && (
                        <div className="text-xs text-secondary font-arabic mt-0.5 text-right md:text-left select-all">
                          {product.name_ar}
                        </div>
                      )}
                      {product.description && (
                        <div className="text-xs text-neutral-500 mt-1 truncate max-w-xs">{product.description}</div>
                      )}
                    </td>
                    <td className="p-4 font-mono text-foreground">
                      {product.barcode ? (
                        <div className="flex items-center space-x-1.5 select-all">
                          <Barcode size={14} className="text-neutral-500" aria-hidden="true" />
                          <span>{product.barcode}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500">Loose Produce</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col space-y-1">
                        <span className="flex items-center space-x-1 text-xs text-secondary">
                          <span className="text-primary/75 font-bold mr-0.5">#</span>
                          <span>{product.category_name || 'Uncategorized'}</span>
                        </span>
                        {product.supplier_name && (
                          <span className="text-[10px] text-neutral-500 font-mono truncate max-w-[120px]" title={`${product.supplier_name} (${product.supplier_code})`}>
                            Sup: {product.supplier_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono text-secondary">
                      EGP {product.cost_price.toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-foreground">
                      EGP {product.selling_price.toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-mono">
                      <div className="flex flex-col items-end">
                        <span className={`font-semibold ${isLow ? 'text-destructive font-bold' : 'text-foreground'}`}>
                          {qty} {product.unit}
                        </span>
                        {isLow && (
                          <span className="flex items-center space-x-0.5 text-[9px] text-destructive uppercase tracking-wider mt-0.5 font-bold" aria-label="Low stock alert">
                            <ShieldAlert size={10} aria-hidden="true" />
                            <span>Low Stock</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <Badge variant={product.is_active ? 'success' : 'outline'}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => onEdit(product)}
                          className="rounded-md p-1.5 text-secondary hover:text-foreground hover:bg-card-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title="Edit details"
                          aria-label={`Edit details for ${product.name}`}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(product)}
                          className="rounded-md p-1.5 text-secondary hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title="Soft delete product"
                          aria-label={`Delete ${product.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="p-12 text-center text-secondary font-medium">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Barcode className="h-8 w-8 text-neutral-500 animate-pulse" aria-hidden="true" />
                    <span>No products found in the catalog.</span>
                    {hasFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onClearFilters}
                        className="mt-2 text-xs font-semibold"
                      >
                        Clear Active Filters
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
