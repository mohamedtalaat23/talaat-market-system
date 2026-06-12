import { Barcode, Edit2, Trash2, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
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
    <Card
      className="overflow-hidden border-border"
      role="region"
      aria-label="Product Catalog Table"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-start text-sm text-foreground" role="table">
          <caption className="sr-only">
            List of store products with names, prices, and stock indicators
          </caption>
          <thead className="bg-neutral-100 border-b border-border text-neutral-700 font-semibold select-none">
            <tr>
              <SortableHeader
                label={t('products.nameDesc')}
                field="name"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort || (() => {})}
              />
              <th scope="col" className="py-2 px-3 font-medium text-start">
                {t('products.barcode')}
              </th>
              <SortableHeader
                label={t('products.category').replace(':', '')}
                field="category"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort || (() => {})}
              />
              <th scope="col" className="py-2 px-3 font-medium text-end">
                {t('products.costPrice')}
              </th>
              <SortableHeader
                label={t('products.sellingPrice')}
                field="selling_price"
                align="end"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort || (() => {})}
              />
              <SortableHeader
                label={t('products.stockQty')}
                field="stock"
                align="end"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={onSort || (() => {})}
              />
              <th scope="col" className="py-2 px-3 font-medium text-center">
                {t('common.status')}
              </th>
              <th scope="col" className="py-2 px-3 font-medium text-center">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border select-text">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-secondary font-medium">
                  {t('products.refreshing')}
                </td>
              </tr>
            ) : products.length > 0 ? (
              products.map((product) => {
                const qty = product.inventory_quantity ?? 0;
                const isLow = qty <= product.min_stock_level;
                return (
                  <tr key={product.id} className="hover:bg-neutral-50 transition-colors bg-white">
                    <td className="py-1.5 px-3">
                      <div className="font-semibold text-foreground leading-tight truncate max-w-[200px]" title={product.name}>
                        {product.name}
                      </div>
                      {product.name_ar && (
                        <div className="text-xs text-secondary font-arabic mt-0.5 text-start select-all truncate max-w-[200px]" title={product.name_ar}>
                          {product.name_ar}
                        </div>
                      )}
                      {product.description && (
                        <div className="text-xs text-neutral-500 mt-0.5 truncate max-w-[200px]" title={product.description}>
                          {product.description}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 px-3 font-mono text-foreground">
                      {product.barcode ? (
                        <div className="flex items-center gap-1.5 select-all">
                          <Barcode size={14} className="text-neutral-500" aria-hidden="true" />
                          <span>{product.barcode}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500">
                          {t('products.looseProduce')}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-xs text-secondary">
                          <span className="text-primary/75 font-bold me-0.5">#</span>
                          <span>
                            {language === 'ar' && product.category_name_ar
                              ? product.category_name_ar
                              : product.category_name || t('products.uncategorized')}
                          </span>
                        </span>
                        {product.supplier_name && (
                          <span
                            className="text-xs text-neutral-500 font-mono truncate max-w-[120px]"
                            title={`${product.supplier_name} (${product.supplier_code})`}
                          >
                            {t('products.supplierLabel')}: {product.supplier_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-end font-mono tabular-nums text-secondary">
                      EGP {product.cost_price.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-3 text-end font-mono tabular-nums font-bold text-foreground">
                      EGP {product.selling_price.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-3 text-end font-mono tabular-nums">
                      <div className="flex flex-col items-end">
                        <span
                          className={`font-semibold ${isLow ? 'text-destructive font-bold' : 'text-foreground'}`}
                        >
                          {qty} {product.unit}
                        </span>
                        {isLow && (
                          <span
                            className="flex items-center gap-0.5 text-xs text-destructive uppercase tracking-wider mt-0.5 font-bold"
                            aria-label="Low stock alert"
                          >
                            <ShieldAlert size={10} aria-hidden="true" />
                            <span>{t('products.lowStock')}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <Badge variant={product.is_active ? 'success' : 'outline'}>
                        {product.is_active ? t('products.active') : t('products.inactive')}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onEdit(product)}
                          className="rounded-md p-1.5 text-secondary hover:text-foreground hover:bg-card-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title={t('products.editDetails')}
                          aria-label={`${t('products.editDetails')} ${product.name}`}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(product)}
                          className="rounded-md p-1.5 text-secondary hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                <td colSpan={8} className="p-12 text-center text-secondary font-medium">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Barcode
                      className="h-8 w-8 text-neutral-500 animate-pulse"
                      aria-hidden="true"
                    />
                    <span>{t('products.noProductsCatalog')}</span>
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
    </Card>
  );
}
