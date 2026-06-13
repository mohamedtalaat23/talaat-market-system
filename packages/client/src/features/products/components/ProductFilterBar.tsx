import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';

export const FILTER_BUTTON_BASE =
  'px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 shrink-0 cursor-pointer';
export const FILTER_BUTTON_ACTIVE =
  'bg-primary text-white border-transparent shadow-[0_4px_10px_rgba(16,185,129,0.3)] hover:opacity-90';
export const FILTER_BUTTON_INACTIVE =
  'bg-card text-secondary border-border/60 hover:text-primary hover:border-primary/40 hover:bg-primary/5';

interface Category {
  id: number;
  name: string;
  name_ar?: string | null;
}

interface ProductFilterBarProps {
  categories: Category[];
  isLoadingCategories: boolean;
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
  debouncedSearch: string;
  onSearchChange: (search: string) => void;
  onClearFilters: () => void;
}

export function ProductFilterBar({
  categories,
  isLoadingCategories,
  selectedCategoryId,
  onSelectCategory,
  debouncedSearch,
  onSearchChange,
  onClearFilters,
}: ProductFilterBarProps) {
  const { t, language } = useTranslation();
  const [searchTerm, setSearchTerm] = useState(debouncedSearch);

  const hasActiveFilters = debouncedSearch || selectedCategoryId !== null;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(searchTerm);
  };

  const handleClear = () => {
    setSearchTerm('');
    onClearFilters();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (val === '') onSearchChange('');
  };

  return (
    <div className="flex flex-col gap-4 mb-6 select-none">
      {/* Search row */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 max-w-sm items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 text-secondary/50 pointer-events-none">
              <Search className="h-4 w-4" />
            </span>
            <Input
              placeholder={t('products.searchPlaceholder')}
              className="ps-10 pe-4 h-10 rounded-xl border-border/60 bg-card focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
              value={searchTerm}
              onChange={handleInputChange}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="font-semibold shrink-0 h-10 rounded-xl px-5">
            {t('common.search')}
          </Button>
        </form>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-10 rounded-xl text-xs text-destructive hover:text-destructive hover:bg-destructive/10 font-semibold gap-1.5 px-3"
          >
            <X size={13} />
            {t('reports.clear')}
          </Button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Category Filters">
        <div className="flex items-center gap-1.5 text-xs text-secondary font-semibold uppercase tracking-wider me-1">
          <SlidersHorizontal size={13} className="text-secondary/60" />
          <span>{t('products.category')}</span>
        </div>

        <button
          onClick={() => onSelectCategory(null)}
          className={`${FILTER_BUTTON_BASE} ${selectedCategoryId === null ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE}`}
          aria-pressed={selectedCategoryId === null}
        >
          {t('products.all')}
        </button>

        {isLoadingCategories ? (
          <span className="text-xs text-secondary/50 italic animate-pulse">{t('products.loadingTags')}</span>
        ) : (
          categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`${FILTER_BUTTON_BASE} ${selectedCategoryId === cat.id ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE}`}
              aria-pressed={selectedCategoryId === cat.id}
            >
              {language === 'ar' && cat.name_ar ? cat.name_ar : cat.name}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
