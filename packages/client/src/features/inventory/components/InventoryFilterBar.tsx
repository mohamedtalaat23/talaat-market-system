import { useState } from 'react';
import { Search, Filter, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
import {
  FILTER_BUTTON_BASE,
  FILTER_BUTTON_ACTIVE,
  FILTER_BUTTON_INACTIVE,
} from '@/features/products/components/ProductFilterBar';

interface Category {
  id: number;
  name: string;
  name_ar?: string | null;
}

interface InventoryFilterBarProps {
  categories: Category[];
  isLoadingCategories: boolean;
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
  debouncedSearch: string;
  onSearchChange: (search: string) => void;
  showLowStock: boolean;
  onToggleLowStock: () => void;
  onClearFilters: () => void;
}

export function InventoryFilterBar({
  categories,
  isLoadingCategories,
  selectedCategoryId,
  onSelectCategory,
  debouncedSearch,
  onSearchChange,
  showLowStock,
  onToggleLowStock,
  onClearFilters,
}: InventoryFilterBarProps) {
  const { t, language } = useTranslation();
  const [searchTerm, setSearchTerm] = useState(debouncedSearch);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(searchTerm);
  };

  const handleClear = () => {
    setSearchTerm('');
    onClearFilters();
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6 select-text">
      <form onSubmit={handleSearchSubmit} className="flex flex-1 max-w-md items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-neutral-500">
            <Search className="h-4 w-4" />
          </span>
          <Input
            placeholder={t('inventory.searchPlaceholder')}
            className="ps-10 focus-visible:ring-2 focus-visible:ring-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="font-semibold shrink-0">
          {t('common.search')}
        </Button>
      </form>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Inventory Filters"
      >
        <div className="flex items-center gap-1 text-xs text-secondary font-semibold uppercase">
          <Filter size={14} className="text-neutral-500" />
          <span>{t('products.category')}</span>
        </div>

        <button
          onClick={() => onSelectCategory(null)}
          className={`${FILTER_BUTTON_BASE} ${
            selectedCategoryId === null ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE
          }`}
          aria-pressed={selectedCategoryId === null}
        >
          {t('products.all')}
        </button>

        {isLoadingCategories ? (
          <span className="text-xs text-neutral-500 font-mono">{t('products.loadingTags')}</span>
        ) : (
          categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`${FILTER_BUTTON_BASE} ${
                selectedCategoryId === cat.id ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE
              }`}
              aria-pressed={selectedCategoryId === cat.id}
            >
              {language === 'ar' && cat.name_ar ? cat.name_ar : cat.name}
            </button>
          ))
        )}

        {/* Low Stock Filter Tag */}
        <button
          onClick={onToggleLowStock}
          className={`${FILTER_BUTTON_BASE} flex items-center gap-1 ${
            showLowStock
              ? 'bg-destructive/15 text-destructive border-destructive/30'
              : FILTER_BUTTON_INACTIVE
          }`}
          aria-pressed={showLowStock}
        >
          <ShieldAlert size={12} />
          <span>{t('inventory.lowStockOnly')}</span>
        </button>

        {(debouncedSearch || selectedCategoryId !== null || showLowStock) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs text-secondary hover:text-destructive shrink-0 font-semibold"
          >
            {t('reports.clear')}
          </Button>
        )}
      </div>
    </div>
  );
}
