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
  'bg-transparent text-secondary border-transparent hover:text-primary hover:bg-primary/5';

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
    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between mb-8 select-text">
      {/* Search row */}
      <div className="flex items-center gap-3 w-full xl:w-auto">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 xl:w-96 items-center gap-2">
          <div className="relative flex-1 flex items-center bg-card rounded-xl border border-border/60 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary">
            <span className="ps-4 text-muted-foreground pointer-events-none">
              <Search className="h-5 w-5" />
            </span>
            <Input
              placeholder={t('products.searchPlaceholder')}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 ps-3 h-12 text-base"
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
      <div className="flex flex-wrap items-center gap-2 select-none bg-card/50 p-1.5 rounded-xl border border-border/40" role="group" aria-label="Category Filters">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-wider mx-2">
          <SlidersHorizontal size={13} />
          <span>{t('products.category')}</span>
        </div>

        <div className="w-[1px] h-6 bg-border/50 mx-1"></div>

        <button
          onClick={() => onSelectCategory(null)}
          className={`${FILTER_BUTTON_BASE} rounded-lg ${selectedCategoryId === null ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE}`}
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
              className={`${FILTER_BUTTON_BASE} rounded-lg ${selectedCategoryId === cat.id ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE}`}
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
