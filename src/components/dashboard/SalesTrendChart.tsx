/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  format,
  subHours,
  subDays,
  subWeeks,
  eachHourOfInterval,
  eachDayOfInterval,
  eachWeekOfInterval,
  isSameHour,
  isSameDay,
  isSameWeek,
  startOfDay,
  differenceInCalendarDays,
  endOfDay,
} from 'date-fns';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { getBills } from '@/lib/mock-data';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { useDashboard } from '@/hooks/use-dashboard';

type Granularity = 'hourly' | 'daily' | 'weekly';
type ViewMode = 'aggregated' | 'comparison';

const OUTLET_COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#06b6d4', '#eab308'];

export const SalesTrendChart: React.FC<{ selectedOutletId: string | 'all' }> = ({
  selectedOutletId,
}) => {
  const [granularity, setGranularity] = React.useState<Granularity>('daily');
  const [viewMode, setViewMode] = React.useState<ViewMode>('aggregated');
  const { outlets, bills, dateRange } = useDashboard();

  const rangeDays = Math.max(1, differenceInCalendarDays(dateRange.to, dateRange.from) + 1);
  const isDefaultSevenDayTrend = granularity === 'daily' && rangeDays === 1;

  const { data, comparedOutlets, summary } = React.useMemo(() => {
    const now = new Date();
    const effectiveEnd = dateRange.to > now ? now : dateRange.to;
    let currentStart: Date;
    let prevStart: Date;
    let currentEnd: Date = effectiveEnd;
    let prevEnd: Date;
    let intervalFunc: (interval: { start: Date; end: Date }) => Date[];
    let formatStr: string;
    let compareFunc: (d1: Date, d2: Date) => boolean;

    if (granularity === 'hourly') {
      currentStart = rangeDays === 1 ? startOfDay(dateRange.from) : subHours(effectiveEnd, 23);
      prevStart = subHours(currentStart, 24);
      prevEnd = subHours(currentEnd, 24);
      intervalFunc = eachHourOfInterval;
      formatStr = 'HH:mm';
      compareFunc = isSameHour;
    } else if (granularity === 'daily') {
      currentStart = rangeDays === 1 ? startOfDay(subDays(effectiveEnd, 6)) : startOfDay(dateRange.from);
      const span = Math.max(1, differenceInCalendarDays(currentEnd, currentStart) + 1);
      prevStart = subDays(currentStart, span);
      prevEnd = subDays(currentEnd, span);
      intervalFunc = eachDayOfInterval;
      formatStr = 'EEE, MMM d';
      compareFunc = isSameDay;
    } else {
      currentStart = rangeDays < 21 ? startOfDay(subWeeks(effectiveEnd, 3)) : startOfDay(dateRange.from);
      const span = Math.max(28, differenceInCalendarDays(currentEnd, currentStart) + 1);
      prevStart = subDays(currentStart, span);
      prevEnd = subDays(currentEnd, span);
      intervalFunc = eachWeekOfInterval;
      formatStr = "'Week' w";
      compareFunc = isSameWeek;
    }

    const currentBills = getBills(
      currentStart,
      endOfDay(currentEnd),
      selectedOutletId === 'all' ? undefined : selectedOutletId
    );
    const prevBills = getBills(
      prevStart,
      endOfDay(prevEnd),
      selectedOutletId === 'all' ? undefined : selectedOutletId
    );

    const intervals = intervalFunc({ start: currentStart, end: currentEnd });
    const prevIntervals = intervalFunc({ start: prevStart, end: prevEnd });

    // Rank outlets by period revenue so comparison stays legible with many outlets
    const outletTotals = new Map<string, number>();
    currentBills.forEach((b) => {
      if (b.status !== 'Cancelled') {
        outletTotals.set(b.outletId, (outletTotals.get(b.outletId) || 0) + b.total);
      }
    });
    const topOutlets = [...outlets]
      .sort((a, b) => (outletTotals.get(b.id) || 0) - (outletTotals.get(a.id) || 0))
      .slice(0, 6);

    let totalCurrentPeriod = 0;
    let totalPrevPeriod = 0;
    let peakLabel = '—';
    let peakAmount = 0;

    const chartData = intervals.map((date: Date, index: number) => {
      const label = format(date, formatStr);
      const currentPeriodBills = currentBills.filter((b) => compareFunc(new Date(b.createdAt), date));
      const currentTotal = currentPeriodBills.reduce(
        (acc, b) => acc + (b.status === 'Cancelled' ? 0 : b.total),
        0
      );

      totalCurrentPeriod += currentTotal;
      if (currentTotal >= peakAmount) {
        peakAmount = currentTotal;
        peakLabel = label;
      }

      const prevDate = prevIntervals[index];
      let prevTotal = 0;
      if (prevDate) {
        const prevPeriodBills = prevBills.filter((b) => compareFunc(new Date(b.createdAt), prevDate));
        prevTotal = prevPeriodBills.reduce(
          (acc, b) => acc + (b.status === 'Cancelled' ? 0 : b.total),
          0
        );
      }
      totalPrevPeriod += prevTotal;

      if (viewMode === 'aggregated' || selectedOutletId !== 'all') {
        return {
          label,
          current: Math.round(currentTotal),
          previous: Math.round(prevTotal),
        };
      }

      const point: Record<string, string | number> = { label };
      topOutlets.forEach((outlet) => {
        const outletBills = currentPeriodBills.filter((b) => b.outletId === outlet.id);
        point[outlet.name] = Math.round(
          outletBills.reduce((acc, b) => acc + (b.status === 'Cancelled' ? 0 : b.total), 0)
        );
      });
      return point;
    });

    const avgPerBucket = intervals.length > 0 ? totalCurrentPeriod / intervals.length : 0;
    const growthPct =
      totalPrevPeriod > 0 ? ((totalCurrentPeriod - totalPrevPeriod) / totalPrevPeriod) * 100 : 0;

    return {
      data: chartData,
      comparedOutlets: topOutlets,
      summary: {
        totalCurrentPeriod,
        avgPerBucket,
        peakLabel,
        peakAmount,
        growthPct,
      },
    };
  }, [granularity, viewMode, selectedOutletId, outlets, bills, dateRange, rangeDays]);

  const isPositiveGrowth = summary.growthPct >= 0;

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold">
                {isDefaultSevenDayTrend
                  ? 'Last 7 Days Sales Revenue Trend'
                  : 'Sales Revenue Trend'}
              </CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  'text-[11px] font-mono tabular-nums gap-1',
                  isPositiveGrowth
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                )}
              >
                {isPositiveGrowth ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {isPositiveGrowth ? '+' : ''}
                {summary.growthPct.toFixed(1)}% vs prior
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {viewMode === 'aggregated' || selectedOutletId !== 'all'
                ? isDefaultSevenDayTrend
                  ? 'Daily total sales revenue across the last 7 days vs prior 7 days'
                  : 'Compare current vs previous period revenue performance'
                : `Side-by-side revenue comparison (Top ${comparedOutlets.length} outlets)`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {selectedOutletId === 'all' && (
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <TabsList className="bg-slate-100/50 border border-slate-200">
                  <TabsTrigger value="aggregated" className="text-xs px-3">
                    Total
                  </TabsTrigger>
                  <TabsTrigger value="comparison" className="text-xs px-3">
                    By Outlet
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
              <TabsList className="bg-slate-100/50 border border-slate-200">
                <TabsTrigger value="hourly" className="text-xs px-3">
                  Hourly
                </TabsTrigger>
                <TabsTrigger value="daily" className="text-xs px-3">
                  {rangeDays === 1 ? '7 Days' : 'Daily'}
                </TabsTrigger>
                <TabsTrigger value="weekly" className="text-xs px-3">
                  Weekly
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {isDefaultSevenDayTrend ? '7-Day Revenue' : 'Period Revenue'}
            </p>
            <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {formatCurrency(summary.totalCurrentPeriod)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {granularity === 'hourly'
                ? 'Hourly Avg'
                : granularity === 'daily'
                  ? 'Daily Avg'
                  : 'Weekly Avg'}
            </p>
            <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
              {formatCurrency(summary.avgPerBucket)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Peak {granularity === 'hourly' ? 'Hour' : granularity === 'daily' ? 'Day' : 'Week'}
            </p>
            <p className="text-base font-bold font-mono tabular-nums text-orange-600 mt-0.5 truncate">
              {summary.peakLabel} · {formatCurrency(summary.peakAmount)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="h-[310px] pl-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              minTickGap={20}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              tickFormatter={(val) => `₹${formatNumber(val)}`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              }}
              formatter={(val) => [formatCurrency(Number(val ?? 0)), '']}
            />
            <Legend verticalAlign="top" align="right" height={32} iconType="circle" iconSize={8} />

            {viewMode === 'aggregated' || selectedOutletId !== 'all' ? (
              <>
                <Line
                  type="monotone"
                  dataKey="current"
                  name={
                    isDefaultSevenDayTrend
                      ? 'Last 7 Days Revenue'
                      : selectedOutletId === 'all'
                        ? 'Total Sales Revenue'
                        : 'Current Period'
                  }
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  animationDuration={800}
                />
                <Line
                  type="monotone"
                  dataKey="previous"
                  name={isDefaultSevenDayTrend ? 'Prior 7 Days' : 'Previous Period'}
                  stroke="#cbd5e1"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  animationDuration={800}
                />
              </>
            ) : (
              comparedOutlets.map((outlet, index) => (
                <Line
                  key={outlet.id}
                  type="monotone"
                  dataKey={outlet.name}
                  name={outlet.name}
                  stroke={OUTLET_COLORS[index % OUTLET_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{
                    r: 3,
                    fill: OUTLET_COLORS[index % OUTLET_COLORS.length],
                    strokeWidth: 2,
                    stroke: '#fff',
                  }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  animationDuration={800}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
