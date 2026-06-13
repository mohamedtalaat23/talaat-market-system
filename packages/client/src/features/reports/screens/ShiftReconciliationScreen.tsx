import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShiftsList } from '../hooks/useReportsQueries';
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
import { CheckCircle, AlertTriangle, HelpCircle, Clock, SearchX } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { useTranslation } from '@/hooks/useTranslation';

export function ShiftReconciliationScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useShiftsList({ page, limit: 15 });

  const renderVarianceBadge = (variance: number | null) => {
    if (variance === null) {
      return (
        <Badge variant="secondary" className="font-mono bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          <HelpCircle className="w-3 h-3 mr-1" />
          N/A
        </Badge>
      );
    }
    if (variance === 0) {
      return (
        <Badge variant="success" className="font-mono bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          {formatCurrency(0)}
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="font-mono bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 shadow-sm animate-pulse">
        <AlertTriangle className="w-3 h-3 mr-1" />
        {formatCurrency(variance)}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-xl bg-gradient-to-b from-card to-card/50 backdrop-blur-xl">
        <CardHeader className="border-b border-border/40 pb-4 bg-primary/5 rounded-t-xl">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Clock className="w-5 h-5" />
            {t('reports.shiftReconciliation')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Spinner />
            </div>
          ) : isError ? (
            <div className="text-destructive text-center p-4">
              {t('reports.failedToLoadShifts')}
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader className="bg-muted/50 table-header-sticky">
                  <TableRow>
                    <TableHead>{t('reports.cashier')}</TableHead>
                    <TableHead>{t('reports.register')}</TableHead>
                    <TableHead>{t('reports.startTime')}</TableHead>
                    <TableHead>{t('reports.endTime')}</TableHead>
                    <TableHead className="text-right">{t('reports.startingCash')}</TableHead>
                    <TableHead className="text-right">{t('reports.expected')}</TableHead>
                    <TableHead className="text-right">{t('reports.actual')}</TableHead>
                    <TableHead className="text-right">{t('reports.variance')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-3">
                          <SearchX className="w-10 h-10 text-muted-foreground/30" />
                          <p className="text-lg font-medium">{t('reports.noClosedShifts')}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.data?.map((shift) => (
                    <TableRow
                      key={shift.id}
                      className="cursor-pointer table-row-hover group"
                      onClick={() => navigate(`/reports/shifts/${shift.id}`)}
                    >
                      <TableCell className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {shift.cashier_name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-secondary">{shift.register_name || 'Main Register'}</TableCell>
                      <TableCell className="text-secondary font-mono text-xs">{formatDateTime(new Date(shift.start_time))}</TableCell>
                      <TableCell className="text-secondary font-mono text-xs">
                        {shift.end_time ? formatDateTime(new Date(shift.end_time)) : <span className="text-primary font-medium">{t('reports.ongoing') || 'Ongoing'}</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(shift.starting_cash)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {shift.expected_cash !== null ? formatCurrency(shift.expected_cash) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        {shift.ending_cash !== null ? formatCurrency(shift.ending_cash) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderVarianceBadge(shift.variance)}
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
