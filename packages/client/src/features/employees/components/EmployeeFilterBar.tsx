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
    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between mb-8 select-text">
      <div className="relative flex-1 max-w-md flex items-center bg-card rounded-xl border border-border/60 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary">
        <span className="ps-4 text-muted-foreground">
          <Search className="h-5 w-5" />
        </span>
        <Input
          placeholder={t('employees.searchPlaceholder')}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 ps-3 h-12 text-base"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div
        className="flex flex-wrap items-center gap-3 select-none bg-card/50 p-1.5 rounded-xl border border-border/40"
        role="group"
        aria-label="Staff Directory Filters"
      >
        {/* Role filter selectors */}
        <div
          className="flex gap-1 border-e border-border/50 pe-3 me-1"
          role="group"
          aria-label="Role Group"
        >
          <button
            onClick={() => onSelectRole(null)}
            className={`${FILTER_BUTTON_BASE} rounded-lg transition-colors ${
              selectedRole === null ? FILTER_BUTTON_ACTIVE + ' shadow-sm' : FILTER_BUTTON_INACTIVE
            }`}
            aria-pressed={selectedRole === null}
          >
            {t('employees.allRoles')}
          </button>
          {(['admin', 'manager', 'cashier'] as const).map((r) => (
            <button
              key={r}
              onClick={() => onSelectRole(r)}
              className={`${FILTER_BUTTON_BASE} rounded-lg transition-colors ${
                selectedRole === r ? FILTER_BUTTON_ACTIVE + ' shadow-sm' : FILTER_BUTTON_INACTIVE
              }`}
              aria-pressed={selectedRole === r}
            >
              {getRoleLabel(r)}
            </button>
          ))}
        </div>

        <div className="flex gap-1" role="group" aria-label="Status Group">
          <button
            onClick={() => onSelectStatus(null)}
            className={`${FILTER_BUTTON_BASE} rounded-lg transition-colors ${
              selectedStatus === null
                ? 'bg-card text-foreground border-border shadow-sm'
                : FILTER_BUTTON_INACTIVE
            }`}
            aria-pressed={selectedStatus === null}
          >
            {t('employees.allStatuses')}
          </button>
          <button
            onClick={() => onSelectStatus(true)}
            className={`${FILTER_BUTTON_BASE} rounded-lg transition-colors ${
              selectedStatus === true
                ? 'bg-success/15 text-success border-success/30 shadow-sm'
                : FILTER_BUTTON_INACTIVE
            }`}
            aria-pressed={selectedStatus === true}
          >
            {t('employees.active')}
          </button>
          <button
            onClick={() => onSelectStatus(false)}
            className={`${FILTER_BUTTON_BASE} rounded-lg transition-colors ${
              selectedStatus === false
                ? 'bg-destructive/10 text-destructive border-destructive/30 shadow-sm'
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
