import { useState } from 'react';
import { useOverridesList } from '../hooks/useReportsQueries';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ShieldAlert, SearchX } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/utils/formatters';
import { useTranslation } from '@/hooks/useTranslation';

export function OverrideAuditScreen() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [activeFilters, setActiveFilters] = useState({ date_from: '', date_to: '' });

  const queryFilters: any = { page, limit: 20 };
  if (activeFilters.date_from) queryFilters.date_from = activeFilters.date_from;
  if (activeFilters.date_to) queryFilters.date_to = `${activeFilters.date_to}T23:59:59.999Z`;

  const { data, isLoading, isError } = useOverridesList(queryFilters);

  const handleApplyFilters = () => {
    setPage(1);
    setActiveFilters({ date_from: dateFrom, date_to: dateTo });
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'reprint_receipt':
        return (
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Reprint
          </Badge>
        );
      case 'void_transaction':
        return <Badge variant="destructive">Void</Badge>;
      case 'price_override':
        return <Badge variant="warning">Price Override</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border border-border/60 shadow-sm rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm text-secondary">{t('reports.dateFrom')}</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-secondary">{t('reports.dateTo')}</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button onClick={handleApplyFilters}>{t('reports.applyFilter')}</Button>
            {(activeFilters.date_from || activeFilters.date_to) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setPage(1);
                  setActiveFilters({ date_from: '', date_to: '' });
                }}
              >
                {t('reports.clear')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-gradient-to-b from-card to-card/50 backdrop-blur-xl">
        <CardHeader className="border-b border-border/40 pb-4 bg-primary/5 rounded-t-xl">
          <CardTitle className="flex items-center gap-2 text-primary">
            <ShieldAlert className="w-5 h-5" />
            {t('reports.managerOverridesLog')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Spinner />
            </div>
          ) : isError ? (
            <div className="text-destructive text-center p-4">
              {t('reports.failedToLoadOverrides')}
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader className="bg-muted/50 table-header-sticky">
                  <TableRow>
                    <TableHead>{t('reports.dateTime')}</TableHead>
                    <TableHead>{t('reports.manager')}</TableHead>
                    <TableHead>{t('reports.cashier')}</TableHead>
                    <TableHead>{t('reports.action')}</TableHead>
                    <TableHead>{t('reports.reference')}</TableHead>
                    <TableHead>{t('reports.details')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-3">
                          <SearchX className="w-10 h-10 text-muted-foreground/30" />
                          <p className="text-lg font-medium">{t('reports.noOverridesRecorded')}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.data?.map((item) => (
                    <TableRow key={item.id} className="table-row-hover group">
                      <TableCell className="text-secondary font-mono text-xs">{formatDateTime(new Date(item.created_at))}</TableCell>
                      <TableCell className="font-medium text-primary">
                        {item.manager_name}
                      </TableCell>
                      <TableCell>{item.cashier_name}</TableCell>
                      <TableCell>{getActionBadge(item.action_type)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.reference_id || '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={item.details || ''}>
                        {item.details || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data?.meta && data.meta.totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {t('reports.previous')}
                  </Button>
                  <span className="flex items-center text-sm text-secondary px-2">
                    {t('reports.pageOf')
                      .replace('{page}', String(page))
                      .replace('{total}', String(data.meta.totalPages))}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page >= data.meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t('reports.next')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
