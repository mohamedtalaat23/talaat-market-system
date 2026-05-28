import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShiftsList } from '../hooks/useReportsQueries';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

export function ShiftReconciliationScreen() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useShiftsList({ page, limit: 15 });

  const renderVarianceBadge = (variance: number | null) => {
    if (variance === null) {
      return <Badge variant="secondary">N/A</Badge>;
    }
    if (variance === 0) {
      return <Badge variant="success">EGP 0.00</Badge>;
    }
    return <Badge variant="destructive">{formatCurrency(variance)}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Shift Reconciliation</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Spinner /></div>
          ) : isError ? (
            <div className="text-destructive text-center p-4">Failed to load shifts.</div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cashier</TableHead>
                    <TableHead>Register</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead className="text-right">Starting Cash</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-neutral-400 py-4">
                        No closed shifts found.
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.data?.map((shift) => (
                    <TableRow
                      key={shift.id}
                      className="cursor-pointer hover:bg-neutral-800/50 transition-colors"
                      onClick={() => navigate(`/reports/shifts/${shift.id}`)}
                    >
                      <TableCell className="font-medium">{shift.cashier_name || 'Unknown'}</TableCell>
                      <TableCell>{shift.register_name || 'Main Register'}</TableCell>
                      <TableCell>{formatDateTime(new Date(shift.start_time))}</TableCell>
                      <TableCell>{shift.end_time ? formatDateTime(new Date(shift.end_time)) : '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(shift.starting_cash)}</TableCell>
                      <TableCell className="text-right">
                        {shift.expected_cash !== null ? formatCurrency(shift.expected_cash) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {shift.ending_cash !== null ? formatCurrency(shift.ending_cash) : '-'}
                      </TableCell>
                      <TableCell className="text-right">{renderVarianceBadge(shift.variance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {data?.meta && data.meta.totalPages > 1 && (
                <div className="flex justify-center space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    disabled={page === 1} 
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center text-sm text-neutral-400">
                    Page {page} of {data.meta.totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    disabled={page >= data.meta.totalPages} 
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
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
