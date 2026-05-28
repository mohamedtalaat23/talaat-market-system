import { Key, UserMinus, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Employee } from '../hooks/useEmployeeQueries';

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
  // Centralized role styling mapping
  const getRoleBadgeDetails = (role: 'admin' | 'manager' | 'cashier') => {
    switch (role) {
      case 'admin':
        return { label: 'Administrator', variant: 'destructive' as const };
      case 'manager':
        return { label: 'Manager', variant: 'default' as const };
      case 'cashier':
        return { label: 'Cashier', variant: 'secondary' as const };
    }
  };

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 border border-neutral-800 rounded-lg bg-neutral-900/10">
        <UserMinus className="h-10 w-10 text-neutral-600 mb-3" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground">No Employees Found</h3>
        <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
          No active cashier or manager accounts match your query parameters.
        </p>
        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="mt-4 text-xs font-semibold"
          >
            Clear Search Query
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
          ? 'border-neutral-800 bg-card hover:border-neutral-700'
          : 'border-neutral-900 bg-neutral-950/80 saturate-50 opacity-75';

        return (
          <Card
            key={emp.id}
            className={`transition-all duration-150 ${activeCardStyle}`}
          >
            <CardContent className="p-5 flex justify-between items-start space-x-4">
              <div className="space-y-2.5 select-text">
                <div className="flex items-center space-x-3">
                  {/* Centralized role initial tagger */}
                  <div 
                    className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm border uppercase shadow-sm shrink-0 ${
                      emp.role === 'admin'
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : emp.role === 'manager'
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                    aria-hidden="true"
                  >
                    {emp.full_name.charAt(0)}
                  </div>
                  
                  <div className="text-left">
                    <h4 className="font-bold text-foreground text-sm leading-tight flex items-center space-x-1.5">
                      <span>{emp.full_name}</span>
                      {!emp.is_active && (
                        <span className="inline-block text-[8px] bg-neutral-900 text-destructive border border-destructive/30 px-1 py-0.5 rounded uppercase font-extrabold select-none">
                          Deactivated
                        </span>
                      )}
                    </h4>
                    <span className="text-xs text-neutral-400 font-mono">@{emp.username}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <Badge variant={role.variant}>{role.label}</Badge>
                  {emp.is_active ? (
                    <Badge variant="success" className="text-[10px] select-none flex items-center space-x-1">
                      <ShieldCheck size={10} aria-hidden="true" />
                      <span>Active Access</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-neutral-500 border-neutral-800 select-none">
                      Suspended
                    </Badge>
                  )}
                </div>

                <div className="text-[10px] text-neutral-500 font-mono select-none pt-0.5">
                  Last Access: {emp.last_login ? new Date(emp.last_login).toLocaleString() : 'Never logged in'}
                </div>
              </div>

              {/* Actions buttons */}
              <div className="flex flex-col space-y-1.5 shrink-0 select-none">
                <Button
                  onClick={() => onEdit(emp)}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold flex items-center space-x-1.5 focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`Edit login details for ${emp.full_name}`}
                >
                  <Key size={12} aria-hidden="true" />
                  <span>Edit Credentials</span>
                </Button>
                <Button
                  onClick={() => onDelete(emp)}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-semibold text-neutral-400 hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center space-x-1.5 focus-visible:ring-2 focus-visible:ring-destructive"
                  aria-label={`Remove access for ${emp.full_name}`}
                >
                  <UserMinus size={12} aria-hidden="true" />
                  <span>Remove</span>
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
