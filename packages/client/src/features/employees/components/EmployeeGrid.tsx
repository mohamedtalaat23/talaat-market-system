import { Key, UserMinus, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Employee } from '../hooks/useEmployeeQueries';
import { useTranslation } from '@/hooks/useTranslation';

interface EmployeeGridProps {
  employees: Employee[];
  onEdit: (emp: Employee) => void;
  onDelete: (emp: Employee) => void;
  onClearFilters: () => void;
  hasFilters: boolean;
}

export function EmployeeGrid({
  employees,
  onEdit,
  onDelete,
  onClearFilters,
  hasFilters,
}: EmployeeGridProps) {
  const { t } = useTranslation();

  // Centralized role styling mapping
  const getRoleBadgeDetails = (role: 'admin' | 'manager' | 'cashier') => {
    switch (role) {
      case 'admin':
        return { label: t('employees.roleAdmin'), variant: 'destructive' as const };
      case 'manager':
        return { label: t('employees.roleManager'), variant: 'default' as const };
      case 'cashier':
        return { label: t('employees.roleCashier'), variant: 'secondary' as const };
    }
  };

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 border border-border rounded-lg bg-card/10">
        <UserMinus className="h-10 w-10 text-neutral-600 mb-3" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground">{t('employees.noEmployees')}</h3>
        <p className="text-sm text-secondary mt-2 leading-relaxed">
          {t('employees.noEmployeesDesc')}
        </p>
        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="mt-4 text-xs font-semibold"
          >
            {t('employees.clearSearch')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2" role="region" aria-label="Staff Access Cards">
      {employees.map((emp) => {
        const role = getRoleBadgeDetails(emp.role);
        // Grayscale deactivation card styling constraint
        const activeCardStyle = emp.is_active
          ? 'border-border bg-card hover:border-border'
          : 'border-border bg-card/60 saturate-50 opacity-75';

        return (
          <Card key={emp.id} className={`transition-all duration-150 ${activeCardStyle}`}>
            <CardContent className="p-5 flex justify-between items-start gap-4">
              <div className="space-y-2.5 select-text flex-1">
                <div className="flex items-center gap-3">
                  {/* Centralized role initial tagger */}
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm border uppercase shadow-sm shrink-0 ${
                      emp.role === 'admin'
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : emp.role === 'manager'
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-card-hover text-secondary border-border'
                    }`}
                    aria-hidden="true"
                  >
                    {emp.full_name.charAt(0)}
                  </div>

                  <div className="text-start">
                    <h4 className="font-bold text-foreground text-sm leading-tight flex items-center gap-1.5 flex-wrap">
                      <span>{emp.full_name}</span>
                      {!emp.is_active && (
                        <span className="inline-block text-[8px] bg-destructive/10 text-destructive border border-destructive/30 px-1 py-0.5 rounded uppercase font-extrabold select-none">
                          {t('employees.deactivated')}
                        </span>
                      )}
                    </h4>
                    <span className="text-xs text-secondary font-mono">@{emp.username}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <Badge variant={role.variant}>{role.label}</Badge>
                  {emp.is_active ? (
                    <Badge
                      variant="success"
                      className="text-xs select-none flex items-center gap-1"
                    >
                      <ShieldCheck size={10} aria-hidden="true" />
                      <span>{t('employees.activeAccess')}</span>
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs text-neutral-500 border-border select-none"
                    >
                      {t('employees.suspended')}
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-neutral-500 font-mono select-none pt-0.5">
                  {emp.last_login
                    ? t('employees.lastAccess').replace(
                        '{time}',
                        new Date(emp.last_login).toLocaleString(),
                      )
                    : t('employees.neverLoggedIn')}
                </div>
              </div>

              {/* Actions buttons */}
              <div className="flex flex-col gap-1.5 shrink-0 select-none items-end rtl:items-start">
                <Button
                  onClick={() => onEdit(emp)}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`Edit login details for ${emp.full_name}`}
                >
                  <Key size={12} aria-hidden="true" />
                  <span>{t('employees.editCredentials')}</span>
                </Button>
                <Button
                  onClick={() => onDelete(emp)}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-semibold text-secondary hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-destructive"
                  aria-label={`Remove access for ${emp.full_name}`}
                >
                  <UserMinus size={12} aria-hidden="true" />
                  <span>{t('employees.remove')}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
export default EmployeeGrid;
