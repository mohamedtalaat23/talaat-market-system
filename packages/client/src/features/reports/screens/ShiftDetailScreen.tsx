import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useShiftDetail } from '../hooks/useReportsQueries';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ArrowLeft, CheckCircle2, XCircle, FileWarning } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

export function ShiftDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const shiftId = Number(id);

  const [txPage, setTxPage] = useState(1);

  const { data, isLoading, isError } = useShiftDetail(shiftId, txPage);

  if (isLoading) {
    return <div className="flex justify-center p-12"><Spinner size="lg" /></div>;
  }

  if (isError || !data?.data) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-destructive">Failed to load shift details.</p>
        <Button variant="outline" onClick={() => navigate('/reports/shifts')}>Back to Shifts</Button>
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
      case 'reprint_receipt': return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">Reprint</Badge>;
      case 'void_transaction': return <Badge variant="destructive">Void</Badge>;
      case 'price_override': return <Badge variant="warning">Price Override</Badge>;
      default: return <Badge variant="secondary">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports/shifts')}>
          <ArrowLeft size={20} />
        </Button>
        <h2 className="text-xl font-semibold">Shift Detail #{shift.id}</h2>
      </div>

      {/* Shift Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Shift Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-secondary mb-1">Cashier</p>
            <p className="font-semibold">{shift.cashier_name || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">Register</p>
            <p className="font-semibold">{shift.register_name || 'Main'}</p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">Duration</p>
            <p className="text-sm">
              {formatDateTime(new Date(shift.start_time))} <br />
              {shift.end_time ? formatDateTime(new Date(shift.end_time)) : 'Ongoing'}
            </p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">Totals</p>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Revenue:</span>
                <span className="font-mono">{formatCurrency(summary.total_revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discounts:</span>
                <span className="font-mono">{formatCurrency(summary.total_discounts)}</span>
              </div>
            </div>
          </div>
          
          <div>
            <p className="text-xs text-secondary mb-1">Starting Cash</p>
            <p className="font-mono">{formatCurrency(shift.starting_cash)}</p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">Expected Cash</p>
            <p className="font-mono">{shift.expected_cash !== null ? formatCurrency(shift.expected_cash) : 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">Actual Ending Cash</p>
            <p className="font-mono font-bold">{shift.ending_cash !== null ? formatCurrency(shift.ending_cash) : 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-secondary mb-1">Variance</p>
            <div className="mt-1">{renderVarianceBadge(shift.variance)}</div>
          </div>
          
          {shift.notes && (
            <div className="col-span-full mt-2 pt-2 border-t border-border">
              <p className="text-xs text-secondary mb-1">Closing Notes</p>
              <p className="text-sm italic">{shift.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Override Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileWarning size={18} className="text-warning" />
            <span>Override Log</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overrides.length === 0 ? (
            <div className="text-center py-6 text-neutral-500 italic">
              No overrides recorded for this shift
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map(ov => (
                  <TableRow key={ov.id}>
                    <TableCell>{formatDateTime(new Date(ov.created_at))}</TableCell>
                    <TableCell>{ov.manager_name}</TableCell>
                    <TableCell>{getActionBadge(ov.action_type)}</TableCell>
                    <TableCell className="max-w-md truncate" title={ov.details || ''}>{ov.details}</TableCell>
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
          <CardTitle>Transactions ({summary.transaction_count})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Discounts</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Prints</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(tx => (
                <TableRow key={tx.id} className={tx.status === 'voided' ? 'line-through text-neutral-500 opacity-60' : ''}>
                  <TableCell className="font-mono text-xs">{tx.receipt_number}</TableCell>
                  <TableCell>{new Date(tx.created_at).toLocaleTimeString()}</TableCell>
                  <TableCell className="capitalize">{tx.payment_method}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(tx.total)}</TableCell>
                  <TableCell className="text-right font-mono text-warning">
                    {(tx.discount_amount + tx.global_discount) > 0 ? `-${formatCurrency(tx.discount_amount + tx.global_discount)}` : '-'}
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
                    No transactions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Transaction Pagination Controls */}
          {transactions_meta && transactions_meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
              <span className="text-xs text-neutral-500 font-mono">
                Page {transactions_meta.page} of {transactions_meta.totalPages}
                {' • '}{transactions_meta.total} total transactions
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  disabled={txPage <= 1}
                >
                  ← Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTxPage((p) => Math.min(transactions_meta.totalPages, p + 1))}
                  disabled={txPage >= transactions_meta.totalPages}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
