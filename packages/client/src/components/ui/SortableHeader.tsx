import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SortableHeaderProps {
  label: string;
  field: string;
  currentSortBy?: string | undefined;
  currentSortOrder?: 'asc' | 'desc' | undefined;
  onSort: (field: string) => void;
  className?: string | undefined;
  align?: 'start' | 'center' | 'end' | undefined;
}

export function SortableHeader({
  label,
  field,
  currentSortBy,
  currentSortOrder,
  onSort,
  className,
  align = 'start',
}: SortableHeaderProps) {
  const isActive = currentSortBy === field;
  const isAsc = currentSortOrder === 'asc';

  return (
    <th
      scope="col"
      className={cn(
        'py-2 px-3 font-medium transition-colors cursor-pointer select-none group hover:bg-card-hover/80',
        align === 'start' && 'text-start',
        align === 'center' && 'text-center',
        align === 'end' && 'text-end',
        className
      )}
      onClick={() => onSort(field)}
      role="button"
      aria-sort={isActive ? (isAsc ? 'ascending' : 'descending') : 'none'}
    >
      <div
        className={cn(
          'flex items-center gap-1.5',
          align === 'end' && 'justify-end',
          align === 'center' && 'justify-center'
        )}
      >
        <span className={cn('truncate', isActive && 'text-primary font-semibold')}>
          {label}
        </span>
        <div className="flex items-center justify-center w-4 h-4 text-secondary">
          {isActive ? (
            isAsc ? (
              <ArrowUp size={14} className="text-primary" />
            ) : (
              <ArrowDown size={14} className="text-primary" />
            )
          ) : (
            <ArrowUp
              size={14}
              className="opacity-0 group-hover:opacity-40 transition-opacity"
            />
          )}
        </div>
      </div>
    </th>
  );
}
