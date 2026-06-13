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
          <span className="absolute inset-y-0 start-0 flex items-center ps-4 text-neutral-400">
            <Search className="h-4 w-4" />
          </span>
          <Input
            placeholder={t('inventory.searchPlaceholder')}
            className="ps-11 h-12 bg-white/80 dark:bg-card/80 backdrop-blur-md border-border/60 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" className="h-12 rounded-xl font-bold px-6 shrink-0 shadow-sm border border-border/60 hover:border-border transition-all hover:-translate-y-0.5">
          {t('common.search')}
        </Button>
      </form>

      <div
        className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide"
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
          <button
            onClick={handleClear}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-secondary hover:text-danger hover:bg-danger/10 border border-transparent rounded-full transition-all duration-300 shrink-0"
          >
            {t('reports.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
