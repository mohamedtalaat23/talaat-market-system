import { Outlet, NavLink } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/Card';
import { FileText, Calendar, ShieldAlert } from 'lucide-react';

export function ReportsLayout() {
  return (
    <PageContainer
      title="Reports & Analytics"
      description="View financial summaries, audit logs, and reconcile cashier shifts."
    >
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation for Reports */}
        <div className="w-full md:w-64 shrink-0">
          <Card>
            <CardContent className="p-2 flex flex-col space-y-1">
              <NavLink
                to="/reports/shifts"
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                    isActive || window.location.pathname.startsWith('/reports/shifts/')
                      ? 'bg-primary/10 text-primary'
                      : 'text-secondary hover:bg-card-hover hover:text-foreground'
                  }`
                }
              >
                <FileText size={18} />
                <span className="font-medium text-sm">Shift Reconciliation</span>
              </NavLink>
              
              <NavLink
                to="/reports/weekly"
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                    isActive ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-card-hover hover:text-foreground'
                  }`
                }
              >
                <Calendar size={18} />
                <span className="font-medium text-sm">Weekly Report</span>
              </NavLink>

              <NavLink
                to="/reports/overrides"
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                    isActive ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-card-hover hover:text-foreground'
                  }`
                }
              >
                <ShieldAlert size={18} />
                <span className="font-medium text-sm">Override Audit</span>
              </NavLink>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </PageContainer>
  );
}
