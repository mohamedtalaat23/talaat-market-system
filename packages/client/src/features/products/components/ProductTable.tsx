import { Barcode, Edit2, Trash2, ShieldAlert, TrendingUp, Package } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { useTranslation } from '@/hooks/useTranslation';
import type { Product } from '../hooks/useProductQueries';

interface ProductTableProps {
  products: Product[];
  isLoading: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onClearFilters: () => void;
  hasFilters: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}

/** Returns a color swatch style for a category pill based on the name. */
function getCategoryColor(name: string): string {
  const palette: Record<string, string> = {
    'Bakery': 'bg-amber-100 text-amber-700 border-amber-200',
    'Beverages': 'bg-blue-100 text-blue-700 border-blue-200',
    'Dairy & Eggs': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Household & Cleaning': 'bg-purple-100 text-purple-700 border-purple-200',
    'Pantry & Groceries': 'bg-green-100 text-green-700 border-green-200',
    'Produce': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Snacks & Sweets': 'bg-rose-100 text-rose-700 border-rose-200',
  };
  return palette[name] || 'bg-primary/8 text-primary border-primary/20';
}

/** Compute profit margin % */
function getMargin(product: Product): number {
  if (!product.cost_price || product.cost_price === 0) return 0;
  return Math.round(((product.selling_price - product.cost_price) / product.selling_price) * 100);
}

export function ProductTable({
  products,
  isLoading,
  onEdit,
  onDelete,
  onClearFilters,
  hasFilters,
  sortBy,
  sortOrder,
  onSort,
}: ProductTableProps) {
  const { t, language } = useTranslation();

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm" role="region" aria-label="Product Catalog Table">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table">
          <caption className="sr-only">List of store products with names, prices, and stock indicators</caption>

          {/* ── Header ────────────────────────────────────────────── */}
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <SortableHeader
                label={t('products.nameDesc')}
                field="name"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort || (() => {})}
                className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-secondary"
              />
              <th scope="col" className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-secondary text-start">
                {t('products.barcode')}
              </th>
              <SortableHeader
                label={t('products.category').replace(':', '')}
                field="category"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort || (() => {})}
                className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-secondary"
              />
              <th scope="col" className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-secondary text-end">
                {t('products.costPrice')}
              </th>
              <SortableHeader
                label={t('products.sellingPrice')}
                field="selling_price"
                align="end"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort || (() => {})}
                className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-secondary"
              />
              <th scope="col" className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-secondary text-center">
                Margin
              </th>
              <SortableHeader
                label={t('products.stockQty')}
                field="stock"
                align="end"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort || (() => {})}
                className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-secondary"
              />
              <th scope="col" className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-secondary text-center">
                {t('common.status')}
              </th>
              <th scope="col" className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-secondary text-center">
                {t('common.actions')}
              </th>
            </tr>
          </thead>

          {/* ── Body ─────────────────────────────────────────────── */}
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-secondary font-medium">
                  {t('products.refreshing')}
                </td>
              </tr>
            ) : products.length > 0 ? (
              products.map((product, index) => {
                const qty = product.inventory_quantity ?? 0;
                const isLow = qty <= product.min_stock_level;
                const margin = getMargin(product);
                const categoryName = language === 'ar' && product.category_name_ar
                  ? product.category_name_ar
                  : product.category_name || t('products.uncategorized');

                return (
                  <tr
                    key={product.id}
                    className="group hover:bg-primary/[0.03] transition-colors duration-150 bg-card"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {/* Name + Arabic */}
                    <td className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary mt-0.5">
                          <Package size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground leading-tight truncate max-w-[200px]" title={product.name}>
                            {product.name}
                          </div>
                          {product.name_ar && (
                            <div className="text-xs text-secondary font-arabic mt-0.5 truncate max-w-[200px]" title={product.name_ar}>
                              {product.name_ar}
                            </div>
                          )}
                          {product.description && (
                            <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]" title={product.description}>
                              {product.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Barcode */}
                    <td className="py-3 px-4">
                      {product.barcode ? (
                        <div className="flex items-center gap-1.5 font-mono text-xs text-secondary select-all bg-muted/50 px-2 py-1 rounded-lg w-fit border border-border/40">
                          <Barcode size={12} className="text-secondary/60" aria-hidden="true" />
                          <span>{product.barcode}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-secondary/50 italic">{t('products.looseProduce')}</span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getCategoryColor(product.category_name || '')}`}>
                        {categoryName}
                      </span>
                      {product.supplier_name && (
                        <div className="text-xs text-secondary/60 mt-1 truncate max-w-[120px]" title={product.supplier_name}>
                          {product.supplier_name}
                        </div>
                      )}
                    </td>

                    {/* Cost Price */}
                    <td className="py-3 px-4 text-end">
                      <span className="font-mono text-sm text-secondary tabular-nums">
                        EGP {product.cost_price.toFixed(2)}
                      </span>
                    </td>

                    {/* Selling Price */}
                    <td className="py-3 px-4 text-end">
                      <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                        EGP {product.selling_price.toFixed(2)}
                      </span>
                    </td>

                    {/* Margin */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1">
                        <TrendingUp size={12} className={margin >= 20 ? 'text-emerald-500' : margin >= 10 ? 'text-amber-500' : 'text-rose-500'} />
                        <span className={`text-xs font-bold tabular-nums ${
                          margin >= 20 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          {margin}%
                        </span>
                      </div>
                    </td>

                    {/* Stock */}
                    <td className="py-3 px-4 text-end">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`font-mono text-sm font-semibold tabular-nums ${isLow ? 'text-destructive' : 'text-foreground'}`}>
                          {qty} <span className="text-xs font-normal text-secondary">{product.unit}</span>
                        </span>
                        {isLow && (
                          <span className="flex items-center gap-0.5 text-[10px] text-destructive uppercase tracking-wider font-bold" aria-label="Low stock alert">
                            <ShieldAlert size={9} aria-hidden="true" />
                            <span>{t('products.lowStock')}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <Badge variant={product.is_active ? 'success' : 'outline'}>
                        {product.is_active ? t('products.active') : t('products.inactive')}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEdit(product)}
                          className="rounded-lg p-2 text-secondary hover:text-primary hover:bg-primary/10 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title={t('products.editDetails')}
                          aria-label={`${t('products.editDetails')} ${product.name}`}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(product)}
                          className="rounded-lg p-2 text-secondary hover:text-destructive hover:bg-destructive/10 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title={t('products.deleteProduct')}
                          aria-label={`${t('products.deleteProduct')} ${product.name}`}
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
                <td colSpan={9} className="p-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                      <Package className="h-8 w-8 text-secondary/40" aria-hidden="true" />
                    </div>
                    <p className="font-semibold text-foreground">{t('products.noProductsCatalog')}</p>
                    <p className="text-sm text-secondary">Try adjusting your filters or add a new product</p>
                    {hasFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onClearFilters}
                        className="mt-2 text-xs font-semibold"
                      >
                        {t('products.clearFilters')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
