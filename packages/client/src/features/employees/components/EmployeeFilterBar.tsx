import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
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
  const { t } = useTranslation();

  const getRoleLabel = (role: EmployeeRole) => {
    switch (role) {
      case 'admin':
        return t('employees.roleAdmin');
      case 'manager':
        return t('employees.roleManager');
      case 'cashier':
        return t('employees.roleCashier');
    }
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6 select-text">
      <div className="relative flex-1 max-w-md">
        <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-neutral-500">
          <Search className="h-4 w-4" />
        </span>
        <Input
          placeholder={t('employees.searchPlaceholder')}
          className="ps-10 focus-visible:ring-2 focus-visible:ring-primary"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div
        className="flex flex-wrap items-center gap-2 select-none"
        role="group"
        aria-label="Staff Directory Filters"
      >
        {/* Role filter selectors */}
        <div
          className="flex gap-1 border-e border-border pe-2 me-2"
          role="group"
          aria-label="Role Group"
        >
          <button
            onClick={() => onSelectRole(null)}
            className={`${FILTER_BUTTON_BASE} ${
              selectedRole === null ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE
            }`}
            aria-pressed={selectedRole === null}
          >
            {t('employees.allRoles')}
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
              {getRoleLabel(r)}
            </button>
          ))}
        </div>

        {/* Active / Inactive filter selectors */}
        <div className="flex gap-1" role="group" aria-label="Status Group">
          <button
            onClick={() => onSelectStatus(null)}
            className={`${FILTER_BUTTON_BASE} ${
              selectedStatus === null
                ? 'bg-card text-foreground border-border'
                : FILTER_BUTTON_INACTIVE
            }`}
            aria-pressed={selectedStatus === null}
          >
            {t('employees.allStatuses')}
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
            {t('employees.active')}
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
            {t('employees.inactive')}
          </button>
        </div>

        {(searchTerm || selectedRole !== null || selectedStatus !== null) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-xs text-secondary hover:text-destructive shrink-0 font-semibold"
          >
            {t('employees.clearSearch')}
          </Button>
        )}
      </div>
    </div>
  );
}
export default EmployeeFilterBar;
