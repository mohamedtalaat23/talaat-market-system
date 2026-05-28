import { useState } from 'react';
import { useOverridesList } from '../hooks/useReportsQueries';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { formatDateTime } from '@/utils/formatters';

export function OverrideAuditScreen() {
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
      case 'reprint_receipt': return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">Reprint</Badge>;
      case 'void_transaction': return <Badge variant="destructive">Void</Badge>;
      case 'price_override': return <Badge variant="warning">Price Override</Badge>;
      default: return <Badge variant="secondary">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">Date From</label>
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-neutral-400">Date To</label>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)} 
              />
            </div>
            <Button onClick={handleApplyFilters}>Apply Filter</Button>
            {(activeFilters.date_from || activeFilters.date_to) && (
              <Button variant="ghost" onClick={() => {
                setDateFrom('');
                setDateTo('');
                setPage(1);
                setActiveFilters({ date_from: '', date_to: '' });
              }}>Clear</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manager Overrides Log</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Spinner /></div>
          ) : isError ? (
            <div className="text-destructive text-center p-4">Failed to load override logs.</div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-neutral-500 italic py-6">
                        No manager overrides have been recorded.
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.data?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDateTime(new Date(item.created_at))}</TableCell>
                      <TableCell className="font-medium text-primary">{item.manager_name}</TableCell>
                      <TableCell>{item.cashier_name}</TableCell>
                      <TableCell>{getActionBadge(item.action_type)}</TableCell>
                      <TableCell className="font-mono text-xs">{item.reference_id || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate" title={item.details || ''}>{item.details || '-'}</TableCell>
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
