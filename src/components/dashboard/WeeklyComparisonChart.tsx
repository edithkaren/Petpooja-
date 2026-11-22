/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  eachDayOfInterval,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  subDays,
} from 'date-fns';
import { ArrowDownRight, ArrowUpRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getBills } from '@/lib/mock-data';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { useDashboard } from '@/hooks/use-dashboard';
import { Bill } from '@/types';

type ComparisonMetric = 'revenue' | 'orders' | 'avgBill';

interface DayComparisonPoint {
  dayLabel: string;
  currentDateLabel: string;
  prevDateLabel: string;
  current: number;
  previous: number;
  diff: number;
  pctChange: number;
  currentOrders: number;
  previousOrders: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DayComparisonPoint }>;
  metric: ComparisonMetric;
}

const formatMetricValue = (value: number, metric: ComparisonMetric): string => {
  if (metric === 'orders') {
    return `${Math.round(value).toLocaleString('en-IN')} orders`;
  }
  return formatCurrency(value);
};

const formatSignedDelta = (diff: number, metric: ComparisonMetric): string => {
  const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
  const absVal = Math.abs(diff);
  if (metric === 'orders') {
    return `${sign}${Math.round(absVal).toLocaleString('en-IN')}`;
  }
  return `${sign}${formatCurrency(absVal)}`;
};

const ComparisonTooltip: React.FC<CustomTooltipProps> = ({ active, payload, metric }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const isPositive = point.diff >= 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3.5 py-2.5 shadow-lg text-xs">
      <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
        {point.dayLabel} Comparison
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">
            Current ({point.currentDateLabel})
          </span>
          <span className="font-mono font-semibold tabular-nums text-orange-600 dark:text-orange-400">
            {formatMetricValue(point.current, metric)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">
            Prior ({point.prevDateLabel})
          </span>
          <span className="font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            {formatMetricValue(point.previous, metric)}
          </span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between gap-6">
        <span className="text-slate-500 dark:text-slate-400">WoW Change</span>
        <span
          className={cn(
            'font-mono font-semibold tabular-nums flex items-center gap-1',
            isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          )}
        >
          {isPositive ? (
            <ArrowUpRight className="w-3.5 h-3.5" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5" />
          )}
          {formatSignedDelta(point.diff, metric)} ({isPositive ? '+' : ''}
          {point.pctChange.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
};

export const WeeklyComparisonChart: React.FC<{ selectedOutletId: string | 'all' }> = ({
  selectedOutletId,
}) => {
  const [metric, setMetric] = React.useState<ComparisonMetric>('revenue');
  const { bills, dateRange } = useDashboard();

  const {
    chartData,
    currentRangeLabel,
    prevRangeLabel,
    currentAggregate,
    prevAggregate,
    aggregateDiff,
    aggregatePct,
    outperformedDays,
    bestDay,
  } = React.useMemo(() => {
    const now = new Date();
    const effectiveEnd = dateRange.to > now ? now : dateRange.to;
    const currentStart = startOfDay(subDays(effectiveEnd, 6));
    const currentEnd = endOfDay(effectiveEnd);
    const prevStart = startOfDay(subDays(currentStart, 7));
    const prevEnd = endOfDay(subDays(currentStart, 1));

    const outletFilter = selectedOutletId === 'all' ? undefined : selectedOutletId;
    const currentBills = getBills(currentStart, currentEnd, outletFilter);
    const prevBills = getBills(prevStart, prevEnd, outletFilter);

    const summarizeBills = (dayBills: Bill[]) => {
      const valid = dayBills.filter((b) => b.status !== 'Cancelled');
      const revenue = valid.reduce((sum, b) => sum + b.total, 0);
      const orders = valid.length;
      const avgBill = orders > 0 ? revenue / orders : 0;
      return { revenue, orders, avgBill };
    };

    const currentDays = eachDayOfInterval({ start: currentStart, end: effectiveEnd });

    let totalCurrRev = 0;
    let totalPrevRev = 0;
    let totalCurrOrders = 0;
    let totalPrevOrders = 0;

    const points: DayComparisonPoint[] = currentDays.map((day) => {
      const prevDay = subDays(day, 7);
      const currStats = summarizeBills(
        currentBills.filter((b) => isSameDay(new Date(b.createdAt), day))
      );
      const prevStats = summarizeBills(
        prevBills.filter((b) => isSameDay(new Date(b.createdAt), prevDay))
      );

      totalCurrRev += currStats.revenue;
      totalPrevRev += prevStats.revenue;
      totalCurrOrders += currStats.orders;
      totalPrevOrders += prevStats.orders;

      const currentVal =
        metric === 'revenue'
          ? Math.round(currStats.revenue)
          : metric === 'orders'
            ? currStats.orders
            : Math.round(currStats.avgBill);

      const prevVal =
        metric === 'revenue'
          ? Math.round(prevStats.revenue)
          : metric === 'orders'
            ? prevStats.orders
            : Math.round(prevStats.avgBill);

      const diff = currentVal - prevVal;
      const pctChange = prevVal > 0 ? (diff / prevVal) * 100 : currentVal > 0 ? 100 : 0;

      return {
        dayLabel: format(day, 'EEE'),
        currentDateLabel: format(day, 'MMM d'),
        prevDateLabel: format(prevDay, 'MMM d'),
        current: currentVal,
        previous: prevVal,
        diff,
        pctChange,
        currentOrders: currStats.orders,
        previousOrders: prevStats.orders,
      };
    });

    const currAgg =
      metric === 'revenue'
        ? totalCurrRev
        : metric === 'orders'
          ? totalCurrOrders
          : totalCurrOrders > 0
            ? totalCurrRev / totalCurrOrders
            : 0;

    const prevAgg =
      metric === 'revenue'
        ? totalPrevRev
        : metric === 'orders'
          ? totalPrevOrders
          : totalPrevOrders > 0
            ? totalPrevRev / totalPrevOrders
            : 0;

    const aggDiff = currAgg - prevAgg;
    const aggPct = prevAgg > 0 ? (aggDiff / prevAgg) * 100 : currAgg > 0 ? 100 : 0;

    const wins = points.filter((p) => p.current >= p.previous).length;
    const topSwing = points.reduce<DayComparisonPoint | null>(
      (best, p) => (!best || p.pctChange > best.pctChange ? p : best),
      null
    );

    return {
      chartData: points,
      currentRangeLabel: `${format(currentStart, 'MMM d')} – ${format(effectiveEnd, 'MMM d')}`,
      prevRangeLabel: `${format(prevStart, 'MMM d')} – ${format(subDays(currentStart, 1), 'MMM d')}`,
      currentAggregate: currAgg,
      prevAggregate: prevAgg,
      aggregateDiff: aggDiff,
      aggregatePct: aggPct,
      outperformedDays: wins,
      bestDay: topSwing,
    };
  }, [bills, dateRange, selectedOutletId, metric]);

  const isPositive = aggregateDiff >= 0;

  return (
    <Card className="border-slate-200 dark:border-neutral-800">
      <CardHeader className="pb-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Week-over-Week Performance Comparison
              </CardTitle>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-mono font-semibold tabular-nums',
                  isPositive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {isPositive ? '+' : ''}
                {aggregatePct.toFixed(1)}% ({formatSignedDelta(aggregateDiff, metric)}) vs prior 7 days
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              <span>Current 7 days ({currentRangeLabel})</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>Previous 7-day window ({prevRangeLabel})</span>
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Comparison metric"
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-neutral-800 self-start lg:self-auto"
          >
            {(
              [
                { id: 'revenue', label: 'Revenue' },
                { id: 'orders', label: 'Orders' },
                { id: 'avgBill', label: 'Avg Bill' },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={metric === option.id}
                onClick={() => setMetric(option.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  metric === option.id
                    ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clean 4-column comparison strip separated by hairline dividers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-neutral-800 border-y border-slate-200 dark:border-neutral-800 py-3">
          <div className="pb-3 lg:pb-0 lg:pr-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Current 7 Days ({metric === 'avgBill' ? 'Avg' : 'Total'})
            </p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {formatMetricValue(currentAggregate, metric)}
            </p>
          </div>

          <div className="pb-3 pl-4 lg:pb-0 lg:px-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Previous 7 Days ({metric === 'avgBill' ? 'Avg' : 'Total'})
            </p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-700 dark:text-slate-300 mt-0.5">
              {formatMetricValue(prevAggregate, metric)}
            </p>
          </div>

          <div className="pt-3 lg:pt-0 lg:px-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Net Period Variance</p>
            <p
              className={cn(
                'text-lg font-bold font-mono tabular-nums mt-0.5 flex items-center gap-1',
                isPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {isPositive ? (
                <ArrowUpRight className="w-4 h-4 shrink-0" />
              ) : (
                <ArrowDownRight className="w-4 h-4 shrink-0" />
              )}
              {formatSignedDelta(aggregateDiff, metric)}
            </p>
          </div>

          <div className="pt-3 pl-4 lg:pt-0 lg:pl-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Days Outperformed</p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {outperformedDays} / 7 days
              {bestDay && (
                <span className="ml-2 text-xs font-medium text-orange-600 dark:text-orange-400">
                  Peak: {bestDay.dayLabel} ({bestDay.pctChange >= 0 ? '+' : ''}
                  {bestDay.pctChange.toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Secondary Grouped Bar Comparison Chart */}
          <div className="xl:col-span-7 h-[280px] pl-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
                <XAxis
                  dataKey="dayLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickFormatter={(val) =>
                    metric === 'orders' ? formatNumber(Number(val)) : `₹${formatNumber(Number(val))}`
                  }
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                  content={<ComparisonTooltip metric={metric} />}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={30}
                  iconType="square"
                  iconSize={10}
                />
                <Bar
                  dataKey="current"
                  name="Current 7 Days"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  animationDuration={700}
                />
                <Bar
                  dataKey="previous"
                  name="Previous 7 Days"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  animationDuration={700}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Day-by-Day WoW Delta Table */}
          <div className="xl:col-span-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-neutral-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 text-left font-medium">Day</th>
                  <th className="py-2 text-right font-medium">Current</th>
                  <th className="py-2 text-right font-medium">Prior</th>
                  <th className="py-2 text-right font-medium">WoW Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                {chartData.map((row) => {
                  const rowUp = row.diff > 0;
                  const rowFlat = row.diff === 0;
                  return (
                    <tr
                      key={row.currentDateLabel}
                      className="hover:bg-slate-50 dark:hover:bg-neutral-800/60 transition-colors"
                    >
                      <td className="py-2.5 pr-2 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {row.dayLabel}
                        </span>
                        <span className="text-slate-400 ml-1.5 font-mono">
                          {row.currentDateLabel}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {metric === 'orders' ? row.current : formatCurrency(row.current)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {metric === 'orders' ? row.previous : formatCurrency(row.previous)}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center justify-end gap-0.5',
                            rowFlat
                              ? 'text-slate-500'
                              : rowUp
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                          )}
                        >
                          {rowFlat ? (
                            <Minus className="w-3 h-3" />
                          ) : rowUp ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {rowUp ? '+' : ''}
                          {row.pctChange.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
