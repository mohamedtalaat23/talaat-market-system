import { Outlet, NavLink } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/Card';
import { FileText, Calendar, ShieldAlert } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export function ReportsLayout() {
  const { t } = useTranslation();

  return (
    <PageContainer title={t('reports.title')} description={t('reports.subtitle')}>
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation for Reports */}
        <div className="w-full lg:w-72 shrink-0">
          <Card className="border-none shadow-lg bg-card/60 backdrop-blur-xl">
            <CardContent className="p-3 flex flex-col space-y-1.5">
              <NavLink
                to="/reports/shifts"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive || window.location.pathname.startsWith('/reports/shifts/')
                      ? 'bg-primary shadow-md shadow-primary/20 text-primary-foreground font-semibold scale-[1.02]'
                      : 'text-secondary hover:bg-secondary/10 hover:text-foreground font-medium'
                  }`
                }
              >
                <FileText size={18} />
                <span className="font-medium text-sm">{t('reports.shiftReconciliation')}</span>
              </NavLink>

              <NavLink
                to="/reports/weekly"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-primary shadow-md shadow-primary/20 text-primary-foreground font-semibold scale-[1.02]'
                      : 'text-secondary hover:bg-secondary/10 hover:text-foreground font-medium'
                  }`
                }
              >
                <Calendar size={18} />
                <span className="font-medium text-sm">{t('reports.weeklyReport')}</span>
              </NavLink>

              <NavLink
                to="/reports/overrides"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-primary shadow-md shadow-primary/20 text-primary-foreground font-semibold scale-[1.02]'
                      : 'text-secondary hover:bg-secondary/10 hover:text-foreground font-medium'
                  }`
                }
              >
                <ShieldAlert size={18} />
                <span className="font-medium text-sm">{t('reports.overrideAudit')}</span>
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
