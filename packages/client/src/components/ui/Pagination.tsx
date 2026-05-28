import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  itemName?: string; // Optional: 'items', 'listings', 'accounts', 'products'
}

/**
 * Standardized Pagination control bar.
 * Uses fully accessible buttons, Chevron navigators, and index calculation labels.
 */
export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  itemName = 'items',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startRange = (page - 1) * limit + 1;
  const endRange = Math.min(page * limit, total);

  return (
    <div 
      className="flex flex-col sm:flex-row items-center justify-between border-t border-neutral-800 px-4 py-3 bg-neutral-900/20 select-none gap-3"
      role="navigation"
      aria-label="Pagination Navigation"
    >
      <div className="text-xs text-neutral-400">
        Showing <span className="font-semibold text-foreground">{startRange}</span> to{' '}
        <span className="font-semibold text-foreground">{endRange}</span> of{' '}
        <span className="font-semibold text-foreground">{total}</span> {itemName}
      </div>

      <div className="flex items-center space-x-3">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 flex items-center space-x-1 text-xs"
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          disabled={page === 1}
          aria-label="Go to previous page"
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <div className="text-xs text-neutral-300 font-mono" aria-current="page">
          Page {page} of {totalPages}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 flex items-center space-x-1 text-xs"
          onClick={() => onPageChange(Math.min(page + 1, totalPages))}
          disabled={page === totalPages}
          aria-label="Go to next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
export default Pagination;
