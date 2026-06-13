import { useMemo, useState } from 'react';
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
import {
  Printer,
  TrendingUp,
  CalendarRange,
  Receipt,
  Wallet,
  Tag,
  BarChart3,
  Trophy,
  AlertCircle,
} from 'lucide-react';
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

function formatCompactCurrency(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return amount.toFixed(0);
}

function formatReportDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatChartDate(dateStr: string): string {
  return dateStr.substring(5).replace('-', '/');
}

function getRankBadgeClass(rank: number): string {
  if (rank === 1) return 'bg-gradient-to-br from-yellow-200 to-amber-400 text-amber-900 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.4)]';
  if (rank === 2) return 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-800 border-slate-300 shadow-sm';
  if (rank === 3) return 'bg-gradient-to-br from-orange-200 to-orange-400 text-orange-900 border-orange-300 shadow-sm';
  return 'bg-card text-secondary border-border shadow-sm';
}

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
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setDate(monday.getDate() + 6);
    return monday.toISOString().substring(0, 10);
  });

  const [activeQuery, setActiveQuery] = useState({ weekStart, weekEnd });

  const { data, isLoading, isError } = useWeeklyReport(activeQuery.weekStart, activeQuery.weekEnd);

  const reportData = data?.data;

  const peakDayDate = useMemo(() => {
    if (!reportData?.days.length) return null;
    return reportData.days.reduce((best, day) =>
      day.net_revenue > best.net_revenue ? day : best,
    ).date;
  }, [reportData?.days]);

  const avgDailyRevenue = reportData ? reportData.totals.net_revenue / 7 : 0;

  const handleLoad = () => {
    setActiveQuery({ weekStart, weekEnd });
  };

  const handlePrint = () => {
    window.print();
  };

  const chartTooltipStyle = {
    backgroundColor: 'var(--bg-card)',
    borderColor: 'var(--border-color)',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
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

      {/* Date range toolbar */}
      <Card className="no-print border border-border/60 shadow-sm rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex items-center gap-2 text-secondary mb-1 lg:mb-0 lg:me-2">
              <CalendarRange size={18} className="text-primary shrink-0" />
              <span className="text-sm font-medium">{t('reports.weeklyReport')}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="space-y-1.5 flex-1 sm:max-w-[180px]">
                <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  {t('reports.weekStart')}
                </label>
                <Input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5 flex-1 sm:max-w-[180px]">
                <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  {t('reports.weekEnd')}
                </label>
                <Input
                  type="date"
                  value={weekEnd}
                  onChange={(e) => setWeekEnd(e.target.value)}
                  className="h-10"
                />
              </div>
              <Button
                onClick={handleLoad}
                className="h-10 px-6 font-semibold bg-success hover:bg-success/90 text-white sm:self-end"
              >
                {t('reports.loadReport')}
              </Button>
            </div>
            <Button
              variant="outline"
              className="h-10 flex items-center gap-2 lg:ms-auto sm:self-end"
              onClick={handlePrint}
              disabled={!reportData}
            >
              <Printer size={16} />
              {t('reports.print')}
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
          <Card className="rounded-2xl">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Spinner size="lg" />
              <span className="mt-3 text-sm text-secondary">{t('common.loading')}</span>
            </CardContent>
          </Card>
        ) : isError || !reportData ? (
          <Card className="rounded-2xl border-destructive/20">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mb-3" />
              <p className="text-destructive font-medium">{t('reports.failedToLoadWeeklyReport')}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Week KPI summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 no-print">
              <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                    {t('reports.netRevenue')}
                  </CardTitle>
                  <div className="h-8 w-8 rounded-xl bg-success/10 flex items-center justify-center">
                    <Wallet className="h-4 w-4 text-success" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tracking-tight text-success font-mono tabular-nums">
                    {formatCurrency(reportData.totals.net_revenue)}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                    {t('reports.transactions')}
                  </CardTitle>
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Receipt className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tracking-tight text-foreground">
                    {reportData.totals.transaction_count}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                    {t('reports.discounts')}
                  </CardTitle>
                  <div className="h-8 w-8 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Tag className="h-4 w-4 text-warning" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tracking-tight text-warning font-mono tabular-nums">
                    {reportData.totals.total_discounts > 0
                      ? `-${formatCurrency(reportData.totals.total_discounts)}`
                      : formatCurrency(0)}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                    {t('reports.avgDailyRevenue')}
                  </CardTitle>
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                    {formatCurrency(avgDailyRevenue)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue trend chart */}
            <Card className="no-print border border-border/60 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/60 bg-card/50">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-success" />
                  <span>{t('reports.revenueTrend')}</span>
                  <span className="text-xs font-normal text-secondary ms-2">
                    {activeQuery.weekStart} — {activeQuery.weekEnd}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={reportData.days}
                      margin={{ top: 10, right: 16, left: 8, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary-500)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border-color)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="var(--text-secondary)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatChartDate}
                      />
                      <YAxis
                        stroke="var(--text-secondary)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        tickFormatter={(val) => formatCompactCurrency(val)}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        itemStyle={{ color: 'var(--color-primary-500)', fontWeight: 600 }}
                        labelStyle={{ color: 'var(--text-secondary)', marginBottom: 4 }}
                        labelFormatter={(label) => formatReportDate(String(label))}
                        formatter={(value: number) => [
                          formatCurrency(value),
                          t('reports.netRevenue'),
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="net_revenue"
                        stroke="var(--color-primary-500)"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        dot={{
                          r: 4,
                          fill: 'var(--color-primary-500)',
                          strokeWidth: 2,
                          stroke: 'var(--bg-card)',
                        }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Daily summary table */}
            <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/60 bg-card/50">
                <CardTitle className="text-base">{t('reports.dailySummary')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="table-header-sticky bg-card/90">
                    <TableRow className="bg-card/90 hover:bg-card/90">
                      <TableHead>{t('reports.date')}</TableHead>
                      <TableHead className="text-right">{t('reports.transactions')}</TableHead>
                      <TableHead className="text-right">{t('reports.revenue')}</TableHead>
                      <TableHead className="text-right">{t('reports.discounts')}</TableHead>
                      <TableHead className="text-right">{t('reports.netRevenue')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.days.map((day) => {
                      const isPeak = day.date === peakDayDate && day.net_revenue > 0;
                      return (
                        <TableRow
                          key={day.date}
                          className={`table-row-hover ${isPeak ? 'bg-success/5 group-hover:bg-success/10' : ''}`}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{formatReportDate(day.date)}</span>
                              <span className="text-xs text-secondary font-mono">{day.date}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {day.transaction_count > 0 ? (
                              <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                                {day.transaction_count}
                              </span>
                            ) : (
                              <span className="text-secondary">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatCurrency(day.total_revenue)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-warning">
                            {day.total_discounts > 0
                              ? `-${formatCurrency(day.total_discounts)}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-semibold text-success">
                            {formatCurrency(day.net_revenue)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-card-hover hover:bg-card-hover border-t-2 border-border font-semibold">
                      <TableCell className="font-bold">{t('reports.totals')}</TableCell>
                      <TableCell className="text-right font-bold">
                        {reportData.totals.transaction_count}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold tabular-nums">
                        {formatCurrency(reportData.totals.total_revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold tabular-nums text-warning">
                        {reportData.totals.total_discounts > 0
                          ? `-${formatCurrency(reportData.totals.total_discounts)}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold tabular-nums text-success text-base">
                        {formatCurrency(reportData.totals.net_revenue)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Top products */}
            <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/60 bg-card/50">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  {t('reports.topProductsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {reportData.top_products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-secondary">
                    <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">{t('reports.noProductsSold')}</p>
                  </div>
                ) : (
                  <div className="grid lg:grid-cols-2 gap-8">
                    <div className="rounded-2xl border border-border/60 overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.02)] bg-card flex flex-col h-full">
                      <Table>
                        <TableHeader className="table-header-sticky bg-muted/40 backdrop-blur-md">
                          <TableRow className="bg-transparent hover:bg-transparent border-b-border/60">
                          <TableHead className="w-16 text-center">{t('reports.rank')}</TableHead>
                          <TableHead>{t('reports.productName')}</TableHead>
                          <TableHead className="text-right">{t('reports.unitsSold')}</TableHead>
                          <TableHead className="text-right">{t('reports.revenue')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.top_products.map((prod, index) => (
                          <TableRow key={index} className="group hover:bg-primary/[0.02] transition-colors border-border/40">
                            <TableCell className="text-center">
                              <span
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-[13px] font-black ${getRankBadgeClass(index + 1)}`}
                              >
                                {index + 1}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium">{prod.product_name}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {prod.total_quantity_sold}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatCurrency(prod.total_revenue)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>

                    <div className="relative h-[400px] lg:h-auto min-h-[400px] no-print rounded-2xl border border-border/80 bg-gradient-to-br from-card to-primary/[0.03] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 group">
                      <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center] pointer-events-none rounded-2xl"></div>
                      <div className="absolute top-4 right-6 text-xs font-bold text-primary/40 uppercase tracking-widest">{t('reports.unitsSold')}</div>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={reportData.top_products}
                          layout="vertical"
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="barColor" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="var(--color-primary-400)" />
                              <stop offset="100%" stopColor="var(--color-primary-600)" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="4 4"
                            stroke="var(--border-color)"
                            horizontal={false}
                            opacity={0.5}
                          />
                          <XAxis type="number" hide />
                          <YAxis
                            type="category"
                            dataKey="product_name"
                            width={180}
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            fontWeight={500}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) =>
                              value.length > 24 ? `${value.substring(0, 24)}...` : value
                            }
                          />
                          <Tooltip
                            cursor={{ fill: 'var(--color-primary-500)', opacity: 0.05 }}
                            contentStyle={chartTooltipStyle}
                            formatter={(value: number) => [value, t('reports.unitsSold')]}
                          />
                          <Bar
                            dataKey="total_quantity_sold"
                            fill="url(#barColor)"
                            radius={[0, 8, 8, 0]}
                            barSize={20}
                            animationDuration={1500}
                            animationEasing="ease-out"
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
