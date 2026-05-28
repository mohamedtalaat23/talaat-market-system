import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  FILTER_BUTTON_BASE,
  FILTER_BUTTON_ACTIVE,
  FILTER_BUTTON_INACTIVE,
} from '@/features/products/components/ProductFilterBar';

type EmployeeRole = 'admin' | 'manager' | 'cashier';

interface EmployeeFilterBarProps {
  searchTerm: string;
  onSearchChange: (search: string) => void;
  selectedRole: EmployeeRole | null;
  onSelectRole: (role: EmployeeRole | null) => void;
  selectedStatus: boolean | null;
  onSelectStatus: (isActive: boolean | null) => void;
  onClearFilters: () => void;
}

export function EmployeeFilterBar({
  searchTerm,
  onSearchChange,
  selectedRole,
  onSelectRole,
  selectedStatus,
  onSelectStatus,
  onClearFilters,
}: EmployeeFilterBarProps) {
  return (
    <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-4 mb-6 select-text">
      <div className="relative flex-1 max-w-md">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
          <Search className="h-4 w-4" />
        </span>
        <Input
          placeholder="Quick search staff by name or username..."
          className="pl-10 focus-visible:ring-2 focus-visible:ring-primary"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 select-none" role="group" aria-label="Staff Directory Filters">
        {/* Role filter selectors */}
        <div className="flex space-x-1 border-r border-neutral-800 pr-2 mr-2" role="group" aria-label="Role Group">
          <button
            onClick={() => onSelectRole(null)}
            className={`${FILTER_BUTTON_BASE} ${
              selectedRole === null ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE
            }`}
            aria-pressed={selectedRole === null}
          >
            All Roles
          </button>
          {(['admin', 'manager', 'cashier'] as const).map((r) => (
            <button
              key={r}
              onClick={() => onSelectRole(r)}
              className={`${FILTER_BUTTON_BASE} ${
                selectedRole === r ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE
              }`}
              aria-pressed={selectedRole === r}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Active / Inactive filter selectors */}
        <div className="flex space-x-1" role="group" aria-label="Status Group">
          <button
            onClick={() => onSelectStatus(null)}
            className={`${FILTER_BUTTON_BASE} ${
              selectedStatus === null ? 'bg-neutral-800 text-foreground border-transparent' : FILTER_BUTTON_INACTIVE
            }`}
            aria-pressed={selectedStatus === null}
          >
            All Statuses
          </button>
          <button
            onClick={() => onSelectStatus(true)}
            className={`${FILTER_BUTTON_BASE} ${
              selectedStatus === true
                ? 'bg-success/20 text-success border-success/30'
                : FILTER_BUTTON_INACTIVE
            }`}
            aria-pressed={selectedStatus === true}
          >
            Active
          </button>
          <button
            onClick={() => onSelectStatus(false)}
            className={`${FILTER_BUTTON_BASE} ${
              selectedStatus === false
                ? 'bg-destructive/15 text-destructive border-destructive/30'
                : FILTER_BUTTON_INACTIVE
            }`}
            aria-pressed={selectedStatus === false}
          >
            Inactive
          </button>
        </div>

        {(searchTerm || selectedRole !== null || selectedStatus !== null) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-xs text-neutral-400 hover:text-destructive shrink-0 font-semibold"
          >
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
export default EmployeeFilterBar;
