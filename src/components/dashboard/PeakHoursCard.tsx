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
  Cell,
} from 'recharts';
import { endOfDay, format, startOfDay } from 'date-fns';
import { Clock, Flame } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getBills } from '@/lib/mock-data';
import { cn, formatCurrency } from '@/lib/utils';
import { useDashboard } from '@/hooks/use-dashboard';

type PeakMetric = 'transactions' | 'revenue';

interface HourSlotData {
  hour: number;
  shortLabel: string;
  windowLabel: string;
  transactions: number;
  revenue: number;
  avgTicket: number;
  sharePct: number;
  isPeak: boolean;
  isHighTraffic: boolean;
}

interface PeakTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: HourSlotData }>;
}

const formatHourWindow = (hour: number): string => {
  const start = `${hour.toString().padStart(2, '0')}:00`;
  const endHour = (hour + 1) % 24;
  const end = `${endHour.toString().padStart(2, '0')}:00`;
  return `${start} – ${end}`;
};

const formatHourShort = (hour: number): string => {
  if (hour === 0) return '12a';
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return '12p';
  return `${hour - 12}p`;
};

const getDaypartLabel = (hour: number): string => {
  if (hour < 12) return 'Morning (Before 12:00)';
  if (hour < 16) return 'Afternoon Lunch (12:00–16:00)';
  if (hour < 20) return 'Evening Coffee Rush (16:00–20:00)';
  return 'Dinner & Late Night (20:00+)';
};

const PeakHoursTooltip: React.FC<PeakTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const slot = payload[0].payload;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3.5 py-2.5 shadow-lg text-xs">
      <div className="flex items-center justify-between gap-4 mb-2">
        <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
          {slot.windowLabel}
        </span>
        {slot.isPeak && (
          <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">
            Peak Hour
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">Transactions</span>
          <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {slot.transactions} ({slot.sharePct.toFixed(1)}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">Hourly Sales</span>
          <span className="font-mono font-semibold tabular-nums text-orange-600 dark:text-orange-400">
            {formatCurrency(slot.revenue)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">Avg Ticket</span>
          <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
            {formatCurrency(slot.avgTicket)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const PeakHoursCard: React.FC<{ selectedOutletId: string | 'all' }> = ({
  selectedOutletId,
}) => {
  const [metric, setMetric] = React.useState<PeakMetric>('transactions');
  const { bills } = useDashboard();

  const {
    hourlySlots,
    peakSlot,
    topThreeSlots,
    totalTodayTxns,
    totalTodayRevenue,
    topDaypart,
    todayDateLabel,
  } = React.useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const outletFilter = selectedOutletId === 'all' ? undefined : selectedOutletId;

    const todayBills = getBills(todayStart, todayEnd, outletFilter).filter(
      (b) => b.status !== 'Cancelled'
    );

    const buckets = new Map<number, { transactions: number; revenue: number }>();
    for (let h = 9; h <= 23; h++) {
      buckets.set(h, { transactions: 0, revenue: 0 });
    }

    todayBills.forEach((bill) => {
      const hour = new Date(bill.createdAt).getHours();
      const existing = buckets.get(hour) || { transactions: 0, revenue: 0 };
      existing.transactions += 1;
      existing.revenue += bill.total;
      buckets.set(hour, existing);
    });

    const totalTxns = todayBills.length;
    const totalRev = todayBills.reduce((sum, b) => sum + b.total, 0);

    const sortedHours = Array.from(buckets.keys()).sort((a, b) => a - b);

    let bestHour = -1;
    let maxTxns = -1;
    let maxRevForBest = -1;

    sortedHours.forEach((h) => {
      const entry = buckets.get(h)!;
      if (
        entry.transactions > maxTxns ||
        (entry.transactions === maxTxns && entry.revenue > maxRevForBest)
      ) {
        maxTxns = entry.transactions;
        maxRevForBest = entry.revenue;
        bestHour = h;
      }
    });

    const slots: HourSlotData[] = sortedHours.map((h) => {
      const entry = buckets.get(h)!;
      const isPeak = maxTxns > 0 && h === bestHour;
      const isHighTraffic = maxTxns > 0 && !isPeak && entry.transactions >= maxTxns * 0.75;
      return {
        hour: h,
        shortLabel: formatHourShort(h),
        windowLabel: formatHourWindow(h),
        transactions: entry.transactions,
        revenue: Math.round(entry.revenue),
        avgTicket: entry.transactions > 0 ? entry.revenue / entry.transactions : 0,
        sharePct: totalTxns > 0 ? (entry.transactions / totalTxns) * 100 : 0,
        isPeak,
        isHighTraffic,
      };
    });

    const ranked = [...slots]
      .filter((s) => s.transactions > 0)
      .sort((a, b) => b.transactions - a.transactions || b.revenue - a.revenue);

    const daypartTotals = new Map<string, number>();
    slots.forEach((s) => {
      const dp = getDaypartLabel(s.hour);
      daypartTotals.set(dp, (daypartTotals.get(dp) || 0) + s.transactions);
    });
    const bestDaypart =
      Array.from(daypartTotals.entries()).sort((a, b) => b[1] - a[1])[0] || null;

    return {
      hourlySlots: slots,
      peakSlot: ranked[0] || null,
      topThreeSlots: ranked.slice(0, 3),
      totalTodayTxns: totalTxns,
      totalTodayRevenue: totalRev,
      topDaypart: bestDaypart
        ? { label: bestDaypart[0], txns: bestDaypart[1] }
        : null,
      todayDateLabel: format(now, 'EEE, dd MMM yyyy'),
    };
  }, [bills, selectedOutletId]);

  return (
    <Card className="border-slate-200 dark:border-neutral-800">
      <CardHeader className="pb-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500 shrink-0" />
                Peak Hours
              </CardTitle>
              {peakSlot && (
                <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-orange-600 dark:text-orange-400">
                  <Flame className="w-3.5 h-3.5" />
                  Busiest: {peakSlot.windowLabel} ({peakSlot.transactions} txns)
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Hourly sales distribution for today ({todayDateLabel}) · {totalTodayTxns} active transactions
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Peak hours metric"
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-neutral-800 self-start sm:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={metric === 'transactions'}
              onClick={() => setMetric('transactions')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                metric === 'transactions'
                  ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              )}
            >
              Transactions
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={metric === 'revenue'}
              onClick={() => setMetric('revenue')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                metric === 'revenue'
                  ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              )}
            >
              Revenue
            </button>
          </div>
        </div>

        {/* Clean 3-column summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-neutral-800 border-y border-slate-200 dark:border-neutral-800 py-3">
          <div className="pb-3 sm:pb-0 sm:pr-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Peak Transaction Window</p>
            <p className="text-lg font-bold font-mono tabular-nums text-orange-600 dark:text-orange-400 mt-0.5">
              {peakSlot ? peakSlot.windowLabel : 'No orders yet'}
            </p>
            {peakSlot && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {peakSlot.transactions} orders · {peakSlot.sharePct.toFixed(1)}% of daily volume
              </p>
            )}
          </div>

          <div className="py-3 sm:py-0 sm:px-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Peak Hour Sales</p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {peakSlot ? formatCurrency(peakSlot.revenue) : formatCurrency(0)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {peakSlot
                ? `Avg ${formatCurrency(peakSlot.avgTicket)} · Total today ${formatCurrency(totalTodayRevenue)}`
                : 'Waiting for orders'}
            </p>
          </div>

          <div className="pt-3 sm:pt-0 sm:pl-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Busiest Daypart</p>
            <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
              {topDaypart && topDaypart.txns > 0 ? topDaypart.label : '—'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {topDaypart && topDaypart.txns > 0
                ? `${topDaypart.txns} orders during peak shift`
                : 'No shift traffic recorded'}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Hourly Bar Chart */}
          <div className="xl:col-span-8 h-[260px] pl-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlySlots} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
                <XAxis
                  dataKey="shortLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  allowDecimals={false}
                  tickFormatter={(val) =>
                    metric === 'revenue'
                      ? `₹${Math.round(Number(val) / 1000)}k`
                      : String(val)
                  }
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                  content={<PeakHoursTooltip />}
                />
                <Bar
                  dataKey={metric}
                  name={metric === 'transactions' ? 'Transactions' : 'Revenue'}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  animationDuration={600}
                >
                  {hourlySlots.map((slot) => (
                    <Cell
                      key={slot.hour}
                      fill={
                        slot.isPeak
                          ? '#f97316'
                          : slot.isHighTraffic
                            ? '#fb923c'
                            : '#cbd5e1'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 3 Busiest Windows Breakdown */}
          <div className="xl:col-span-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-neutral-800 pb-2">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Top 3 Busiest Slots Today
              </span>
              <span className="font-mono">Volume · Sales</span>
            </div>

            {topThreeSlots.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                No transactions recorded yet for today.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                {topThreeSlots.map((slot, index) => {
                  const barWidth = peakSlot
                    ? Math.max(12, Math.round((slot.transactions / peakSlot.transactions) * 100))
                    : 0;
                  return (
                    <div key={slot.hour} className="py-3 first:pt-1 last:pb-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              'font-mono font-bold w-5 text-left shrink-0',
                              index === 0
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-slate-400'
                            )}
                          >
                            0{index + 1}.
                          </span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {slot.windowLabel}
                          </span>
                        </div>
                        <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200 shrink-0">
                          {slot.transactions} txns · {formatCurrency(slot.revenue)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            index === 0 ? 'bg-orange-500' : 'bg-slate-400 dark:bg-slate-500'
                          )}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="pt-2 border-t border-slate-100 dark:border-neutral-800 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-orange-500" />
                Peak window
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-orange-400" />
                High traffic (≥75%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-300" />
                Standard
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
