import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

// Reusable Tailwind visual class patterns for filter inputs (standardized styling)
export const FILTER_BUTTON_BASE =
  'px-3 py-1.5 rounded-md text-xs font-semibold uppercase border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary';
export const FILTER_BUTTON_ACTIVE =
  'bg-primary text-primary-foreground border-transparent';
export const FILTER_BUTTON_INACTIVE =
  'bg-neutral-900 text-secondary border-border hover:text-foreground';

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
    <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-4 mb-6 select-text">
      <form onSubmit={handleSearchSubmit} className="flex flex-1 max-w-md items-center space-x-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
            <Search className="h-4 w-4" />
          </span>
          <Input
            placeholder="Search by name, barcode, or SKU..."
            className="pl-10 focus-visible:ring-2 focus-visible:ring-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="font-semibold shrink-0">
          Search
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Category Filters">
        <div className="flex items-center space-x-1 text-xs text-secondary font-semibold uppercase mr-1">
          <Filter size={14} className="text-neutral-500" />
          <span>Category:</span>
        </div>

        <button
          onClick={() => onSelectCategory(null)}
          className={`${FILTER_BUTTON_BASE} ${
            selectedCategoryId === null ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE
          }`}
          aria-pressed={selectedCategoryId === null}
        >
          All
        </button>

        {isLoadingCategories ? (
          <span className="text-xs text-neutral-500 font-mono">Loading tags...</span>
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
              {cat.name}
            </button>
          ))
        )}

        {(debouncedSearch || selectedCategoryId !== null) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs text-secondary hover:text-destructive shrink-0 font-semibold"
          >
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
