import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useShiftDetail } from '../hooks/useReportsQueries';
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
import { Spinner } from '@/components/ui/Spinner';
import { ArrowLeft, CheckCircle2, XCircle, FileWarning } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { useTranslation } from '@/hooks/useTranslation';

export function ShiftDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const shiftId = Number(id);

  const [txPage, setTxPage] = useState(1);

  const { data, isLoading, isError } = useShiftDetail(shiftId, txPage);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-destructive">{t('reports.failedToLoadShiftDetail')}</p>
        <Button variant="outline" onClick={() => navigate('/reports/shifts')}>
          {t('reports.backToShifts')}
        </Button>
      </div>
    );
  }

  const { shift, summary, transactions, overrides, transactions_meta } = data.data;

  const renderVarianceBadge = (variance: number | null) => {
    if (variance === null) return <Badge variant="secondary">N/A</Badge>;
    if (variance === 0) return <Badge variant="success">EGP 0.00</Badge>;
    return <Badge variant="destructive">{formatCurrency(variance)}</Badge>;
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports/shifts')}>
          <ArrowLeft size={20} />
        </Button>
        <h2 className="text-xl font-semibold">
          {t('reports.shiftDetailTitle').replace('{id}', String(shift.id))}
        </h2>
      </div>

      {/* Shift Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('reports.shiftSummary')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-secondary mb-1">{t('reports.cashier')}</p>
            <p className="font-semibold">{shift.cashier_name || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">{t('reports.register')}</p>
            <p className="font-semibold">{shift.register_name || 'Main'}</p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">{t('reports.duration')}</p>
            <p className="text-sm">
              {formatDateTime(new Date(shift.start_time))} <br />
              {shift.end_time ? formatDateTime(new Date(shift.end_time)) : t('reports.ongoing')}
            </p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">{t('reports.totals')}</p>
            <div className="text-sm space-y-1">
              <div className="flex justify-between gap-4">
                <span>{t('reports.revenue')}:</span>
                <span className="font-mono">{formatCurrency(summary.total_revenue)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>{t('reports.discounts')}:</span>
                <span className="font-mono">{formatCurrency(summary.total_discounts)}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-secondary mb-1">{t('reports.startingCash')}</p>
            <p className="font-mono">{formatCurrency(shift.starting_cash)}</p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">{t('reports.expectedCash')}</p>
            <p className="font-mono">
              {shift.expected_cash !== null ? formatCurrency(shift.expected_cash) : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">{t('reports.actualEndingCash')}</p>
            <p className="font-mono font-bold">
              {shift.ending_cash !== null ? formatCurrency(shift.ending_cash) : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">{t('reports.variance')}</p>
            <div className="mt-1">{renderVarianceBadge(shift.variance)}</div>
          </div>

          {shift.notes && (
            <div className="col-span-full mt-2 pt-2 border-t border-border">
              <p className="text-xs text-secondary mb-1">{t('reports.closingNotes')}</p>
              <p className="text-sm italic">{shift.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Override Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileWarning size={18} className="text-warning" />
            <span>{t('reports.overrideLog')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overrides.length === 0 ? (
            <div className="text-center py-6 text-neutral-500 italic">
              {t('reports.noOverridesForShift')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reports.time')}</TableHead>
                  <TableHead>{t('reports.manager')}</TableHead>
                  <TableHead>{t('reports.action')}</TableHead>
                  <TableHead>{t('reports.details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((ov) => (
                  <TableRow key={ov.id}>
                    <TableCell>{formatDateTime(new Date(ov.created_at))}</TableCell>
                    <TableCell>{ov.manager_name}</TableCell>
                    <TableCell>{getActionBadge(ov.action_type)}</TableCell>
                    <TableCell className="max-w-md truncate" title={ov.details || ''}>
                      {ov.details}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('reports.transactions')} ({summary.transaction_count})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reports.receiptNumber')}</TableHead>
                <TableHead>{t('reports.time')}</TableHead>
                <TableHead>{t('reports.paymentMethod')}</TableHead>
                <TableHead className="text-right">{t('pos.total')}</TableHead>
                <TableHead className="text-right">{t('reports.discounts')}</TableHead>
                <TableHead className="text-center">{t('common.status')}</TableHead>
                <TableHead className="text-center">{t('reports.prints')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className={
                    tx.status === 'voided' ? 'line-through text-neutral-500 opacity-60' : ''
                  }
                >
                  <TableCell className="font-mono text-xs">{tx.receipt_number}</TableCell>
                  <TableCell>{new Date(tx.created_at).toLocaleTimeString()}</TableCell>
                  <TableCell className="capitalize">{tx.payment_method}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(tx.total)}</TableCell>
                  <TableCell className="text-right font-mono text-warning">
                    {tx.discount_amount + tx.global_discount > 0
                      ? `-${formatCurrency(tx.discount_amount + tx.global_discount)}`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {tx.status === 'completed' ? (
                      <CheckCircle2 size={16} className="text-success mx-auto" />
                    ) : (
                      <XCircle size={16} className="text-destructive mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">{tx.print_count}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-neutral-500">
                    {t('reports.noTransactionsFound')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Transaction Pagination Controls */}
          {transactions_meta && transactions_meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
              <span className="text-xs text-neutral-500 font-mono">
                {t('reports.pageOf')
                  .replace('{page}', String(transactions_meta.page))
                  .replace('{total}', String(transactions_meta.totalPages))}
                {' • '}
                {transactions_meta.total} {t('reports.transactions')}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  disabled={txPage <= 1}
                >
                  ← {t('reports.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTxPage((p) => Math.min(transactions_meta.totalPages, p + 1))}
                  disabled={txPage >= transactions_meta.totalPages}
                >
                  {t('reports.next')} →
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
