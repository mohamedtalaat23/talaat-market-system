import { useState } from 'react';
import { useWeeklyReport } from '../hooks/useReportsQueries';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Printer, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { useTranslation } from '@/hooks/useTranslation';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

export function WeeklyReportScreen() {
  const { t } = useTranslation();
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().substring(0, 10);
  });

  const [weekEnd, setWeekEnd] = useState(() => {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + 6);
    return start.toISOString().substring(0, 10);
  });

  const [activeQuery, setActiveQuery] = useState({ weekStart, weekEnd });

  const { data, isLoading, isError } = useWeeklyReport(activeQuery.weekStart, activeQuery.weekEnd);

  const handleLoad = () => {
    setActiveQuery({ weekStart, weekEnd });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Controls - Hidden on Print */}
      <Card className="no-print">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm text-secondary">{t('reports.weekStart')}</label>
              <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-secondary">{t('reports.weekEnd')}</label>
              <Input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} />
            </div>
            <Button onClick={handleLoad}>{t('reports.loadReport')}</Button>
            <Button
              variant="outline"
              className="ml-auto flex items-center gap-2"
              onClick={handlePrint}
            >
              <Printer size={16} /> {t('reports.print')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div id="print-area" className="space-y-6">
        <h2 className="text-2xl font-bold hidden print:block mb-4">
          {t('reports.weeklyReportTitle')
            .replace('{start}', activeQuery.weekStart)
            .replace('{end}', activeQuery.weekEnd)}
        </h2>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Spinner size="lg" />
          </div>
        ) : isError || !data?.data ? (
          <div className="p-6 text-center text-destructive">
            {t('reports.failedToLoadWeeklyReport')}
          </div>
        ) : (
          <>
            {/* Daily Revenue Chart */}
            <Card className="no-print">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span>{t('reports.revenueTrend')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.data.days}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="var(--color-primary-500)"
                            stopOpacity={0.3}
                          />
                          <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-neutral-800)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="var(--color-neutral-500)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => val.substring(5)}
                      />
                      <YAxis
                        stroke="var(--color-neutral-500)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `$${val}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--bg-modal)',
                          borderColor: 'var(--color-neutral-700)',
                          borderRadius: '8px',
                        }}
                        itemStyle={{ color: 'var(--color-primary-400)', fontWeight: 'bold' }}
                        labelStyle={{ color: 'var(--color-neutral-400)', marginBottom: '4px' }}
                        formatter={(value: number) => [
                          formatCurrency(value),
                          t('reports.netRevenue'),
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="net_revenue"
                        stroke="var(--color-primary-500)"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Daily Summary */}
            <Card>
              <CardHeader>
                <CardTitle>{t('reports.dailySummary')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.date')}</TableHead>
                      <TableHead className="text-right">{t('reports.transactions')}</TableHead>
                      <TableHead className="text-right">{t('reports.revenue')}</TableHead>
                      <TableHead className="text-right">{t('reports.discounts')}</TableHead>
                      <TableHead className="text-right">{t('reports.netRevenue')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.days.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="font-medium">{day.date}</TableCell>
                        <TableCell className="text-right">{day.transaction_count}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(day.total_revenue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-warning">
                          {day.total_discounts > 0
                            ? `-${formatCurrency(day.total_discounts)}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-success">
                          {formatCurrency(day.net_revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-card-hover border-t-2 border-border">
                      <TableCell className="font-bold text-lg">{t('reports.totals')}</TableCell>
                      <TableCell className="text-right font-bold">
                        {data.data.totals.transaction_count}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatCurrency(data.data.totals.total_revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-warning">
                        {data.data.totals.total_discounts > 0
                          ? `-${formatCurrency(data.data.totals.total_discounts)}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-success text-lg">
                        {formatCurrency(data.data.totals.net_revenue)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle>{t('reports.topProductsTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.data.top_products.length === 0 ? (
                  <div className="text-center py-6 text-neutral-500 italic">
                    {t('reports.noProductsSold')}
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16 text-center">{t('reports.rank')}</TableHead>
                            <TableHead>{t('reports.productName')}</TableHead>
                            <TableHead className="text-right">{t('reports.unitsSold')}</TableHead>
                            <TableHead className="text-right">{t('reports.revenue')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.data.top_products.map((prod, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-center font-bold text-secondary">
                                #{index + 1}
                              </TableCell>
                              <TableCell className="font-medium">{prod.product_name}</TableCell>
                              <TableCell className="text-right">
                                {prod.total_quantity_sold}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(prod.total_revenue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="h-[300px] no-print">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.data.top_products}
                          layout="vertical"
                          margin={{ top: 0, right: 0, left: 30, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--color-neutral-800)"
                            horizontal={false}
                          />
                          <XAxis type="number" hide />
                          <YAxis
                            type="category"
                            dataKey="product_name"
                            width={120}
                            stroke="var(--color-neutral-400)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: 'var(--color-neutral-800)' }}
                            contentStyle={{
                              backgroundColor: 'var(--bg-modal)',
                              borderColor: 'var(--color-neutral-700)',
                              borderRadius: '8px',
                            }}
                            formatter={(value: number) => [value, t('reports.unitsSold')]}
                          />
                          <Bar
                            dataKey="total_quantity_sold"
                            fill="var(--color-primary-500)"
                            radius={[0, 4, 4, 0]}
                            barSize={20}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
