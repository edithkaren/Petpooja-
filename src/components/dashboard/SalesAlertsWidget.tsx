/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { endOfDay, format, startOfDay, subDays } from 'date-fns';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Check,
  Flame,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';

import { getBills } from '@/lib/mock-data';
import { useDashboard } from '@/hooks/use-dashboard';
import { cn, formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateRangeLabel } from '@/components/common/DateRangePicker';

export type AlertType = 'spike' | 'drop' | 'cancellation_surge' | 'ticket_surge';
export type AlertSeverity = 'critical' | 'warning' | 'positive';
export type OverallStatus = 'nominal' | 'spike_detected' | 'drop_detected' | 'mixed_anomalies';

export interface SalesAnomalyAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  outletName: string;
  metricValue: string;
  timeframe: string;
  explanation: string;
  recommendedAction: string;
}

interface AnalyzeAlertsResponse {
  summary: string;
  overallStatus: OverallStatus;
  alerts: SalesAnomalyAlert[];
  analyzedAt?: string;
}

const OVERALL_STATUS_META: Record<
  OverallStatus,
  { label: string; textClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  nominal: {
    label: 'Operating Normally',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    icon: Sparkles,
  },
  spike_detected: {
    label: 'Sales Surge Detected',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    icon: TrendingUp,
  },
  drop_detected: {
    label: 'Revenue Drop Flagged',
    textClass: 'text-rose-600 dark:text-rose-400',
    icon: TrendingDown,
  },
  mixed_anomalies: {
    label: 'Mixed Spikes & Drops',
    textClass: 'text-amber-600 dark:text-amber-400',
    icon: AlertTriangle,
  },
};

const ALERT_TYPE_META: Record<
  AlertType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  spike: { label: 'Sales Spike', icon: TrendingUp },
  drop: { label: 'Sales Drop', icon: TrendingDown },
  cancellation_surge: { label: 'Cancellation Surge', icon: XCircle },
  ticket_surge: { label: 'Ticket Surge', icon: Flame },
};

const SEVERITY_META: Record<
  AlertSeverity,
  { label: string; badgeClass: string; metricClass: string }
> = {
  critical: {
    label: 'Critical',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    metricClass: 'text-rose-600 dark:text-rose-400',
  },
  warning: {
    label: 'Warning',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    metricClass: 'text-amber-600 dark:text-amber-400',
  },
  positive: {
    label: 'Positive Spike',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    metricClass: 'text-emerald-600 dark:text-emerald-400',
  },
};

export const SalesAlertsWidget: React.FC = () => {
  const {
    bills,
    outlets,
    selectedOutletId,
    setSelectedOutletId,
    dateRange,
    isLiveFeedPaused,
  } = useDashboard();

  const [analysis, setAnalysis] = React.useState<AnalyzeAlertsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = React.useState<string[]>([]);
  const [typeFilter, setTypeFilter] = React.useState<'all' | 'positive' | 'risk'>('all');

  const lastAnalyzedSignatureRef = React.useRef<string>('');
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const telemetry = React.useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const outletFilter = selectedOutletId === 'all' ? undefined : selectedOutletId;

    const activeBills = bills.filter((b) => b.status !== 'Cancelled');
    const cancelledCount = bills.length - activeBills.length;
    const totalSales = activeBills.reduce((sum, b) => sum + b.total, 0);
    const avgBill = activeBills.length > 0 ? totalSales / activeBills.length : 0;
    const cancellationRatePct =
      bills.length > 0 ? Number(((cancelledCount / bills.length) * 100).toFixed(1)) : 0;

    // Intraday hourly comparison vs trailing 7-day average per hour
    const todayBills = getBills(todayStart, todayEnd, outletFilter);
    const baselineBills = getBills(subDays(todayStart, 7), subDays(todayEnd, 1), outletFilter);

    const hourlyCurrent = new Array<number>(24).fill(0);
    const hourlyCurrentOrders = new Array<number>(24).fill(0);
    const hourlyBaseline = new Array<number>(24).fill(0);
    const hourlyBaselineOrders = new Array<number>(24).fill(0);

    todayBills.forEach((b) => {
      if (b.status === 'Cancelled') return;
      const hr = new Date(b.createdAt).getHours();
      hourlyCurrent[hr] += b.total;
      hourlyCurrentOrders[hr] += 1;
    });

    baselineBills.forEach((b) => {
      if (b.status === 'Cancelled') return;
      const hr = new Date(b.createdAt).getHours();
      hourlyBaseline[hr] += b.total;
      hourlyBaselineOrders[hr] += 1;
    });

    const hourlySeries = [];
    for (let hr = 0; hr <= currentHour; hr++) {
      const currRev = Math.round(hourlyCurrent[hr]);
      const baseRev = Math.round(hourlyBaseline[hr] / 7);
      const currOrd = hourlyCurrentOrders[hr];
      const baseOrd = Number((hourlyBaselineOrders[hr] / 7).toFixed(1));
      if (currRev === 0 && baseRev === 0) continue;
      const deltaPct =
        baseRev > 0
          ? Number((((currRev - baseRev) / baseRev) * 100).toFixed(1))
          : currRev > 0
            ? 100
            : 0;
      hourlySeries.push({
        hourLabel: `${hr.toString().padStart(2, '0')}:00-${((hr + 1) % 24)
          .toString()
          .padStart(2, '0')}:00`,
        currentRevenue: currRev,
        baselineRevenue: baseRev,
        currentOrders: currOrd,
        baselineOrders: baseOrd,
        deltaPct,
      });
    }

    // Outlet performance vs same-time-of-day 7-day baseline
    const targetOutlets =
      selectedOutletId === 'all'
        ? outlets
        : outlets.filter((o) => o.id === selectedOutletId);

    const allTodayBills = getBills(todayStart, todayEnd);
    const allBaselineBills = getBills(subDays(todayStart, 7), subDays(todayEnd, 1));

    const outletPerformances = targetOutlets
      .map((outlet) => {
        const currOutletBills = allTodayBills.filter((b) => b.outletId === outlet.id);
        const currActive = currOutletBills.filter((b) => b.status !== 'Cancelled');
        const currRev = Math.round(currActive.reduce((sum, b) => sum + b.total, 0));

        const baseOutletBills = allBaselineBills.filter(
          (b) =>
            b.outletId === outlet.id &&
            b.status !== 'Cancelled' &&
            new Date(b.createdAt).getHours() <= currentHour
        );
        const baseRev = Math.round(
          baseOutletBills.reduce((sum, b) => sum + b.total, 0) / 7
        );
        const deltaPct =
          baseRev > 0
            ? Number((((currRev - baseRev) / baseRev) * 100).toFixed(1))
            : currRev > 0
              ? 100
              : 0;

        return {
          outletName: outlet.name,
          city: outlet.city,
          currentRevenue: currRev,
          baselineExpectedRevenue: baseRev,
          deltaPct,
          ordersCount: currOutletBills.length,
          cancelledCount: currOutletBills.length - currActive.length,
        };
      })
      .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
      .slice(0, 10);

    // Recent 15-minute burst
    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
    const recentBills = bills.filter(
      (b) => new Date(b.createdAt).getTime() >= fifteenMinsAgo
    );
    const recentActive = recentBills.filter((b) => b.status !== 'Cancelled');
    const last15MinRevenue = Math.round(
      recentActive.reduce((sum, b) => sum + b.total, 0)
    );
    const highPriorityCount = recentBills.filter((b) => b.isHighPriority).length;

    const latestBill = [...bills].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    const latestOutletName = latestBill
      ? outlets.find((o) => o.id === latestBill.outletId)?.name || latestBill.outletId
      : undefined;

    const selectedOutlet =
      selectedOutletId === 'all'
        ? null
        : outlets.find((o) => o.id === selectedOutletId);

    const payload = {
      outletScope: selectedOutlet
        ? `${selectedOutlet.name} (${selectedOutlet.city})`
        : `All Outlets (${outlets.length})`,
      dateRangeLabel: formatDateRangeLabel(dateRange.from, dateRange.to),
      currentHourLabel: `${currentHour.toString().padStart(2, '0')}:00`,
      summary: {
        totalSales: Math.round(totalSales),
        ordersCount: bills.length,
        avgBill: Math.round(avgBill),
        cancelledCount,
        cancellationRatePct,
      },
      hourlySeries: hourlySeries.slice(-10),
      outletPerformances,
      recentBurst: {
        last15MinOrders: recentBills.length,
        last15MinRevenue,
        highPriorityCount,
        latestBillSummary: latestBill
          ? `${latestOutletName} · ${formatCurrency(latestBill.total)} (${latestBill.status}, ${latestBill.source})`
          : undefined,
      },
    };

    const signature = [
      selectedOutletId,
      dateRange.from.getTime(),
      dateRange.to.getTime(),
      bills.length,
      Math.round(totalSales),
      cancelledCount,
    ].join('|');

    return { payload, signature };
  }, [bills, outlets, selectedOutletId, dateRange.from, dateRange.to]);

  const runAnalysis = React.useCallback(
    async (force = false) => {
      if (!force && lastAnalyzedSignatureRef.current === telemetry.signature) {
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/alerts/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telemetry.payload),
          signal: controller.signal,
        });

        const data = (await res.json()) as AnalyzeAlertsResponse & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || `AI anomaly check failed (${res.status})`);
        }

        lastAnalyzedSignatureRef.current = telemetry.signature;
        setAnalysis(data);
        setDismissedIds([]);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to reach real-time AI alert service.'
        );
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
        }
      }
    },
    [telemetry]
  );

  // Auto-scan when telemetry context shifts, unless live feed is paused
  React.useEffect(() => {
    if (isLiveFeedPaused && analysis !== null) {
      return;
    }
    const timer = setTimeout(() => {
      void runAnalysis(false);
    }, 650);

    return () => {
      clearTimeout(timer);
    };
  }, [runAnalysis, isLiveFeedPaused, analysis]);

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const visibleAlerts = React.useMemo(() => {
    if (!analysis?.alerts) return [];
    return analysis.alerts.filter((alert) => {
      if (dismissedIds.includes(alert.id)) return false;
      if (typeFilter === 'positive') {
        return alert.severity === 'positive' || alert.type === 'spike' || alert.type === 'ticket_surge';
      }
      if (typeFilter === 'risk') {
        return (
          alert.severity === 'critical' ||
          alert.severity === 'warning' ||
          alert.type === 'drop' ||
          alert.type === 'cancellation_surge'
        );
      }
      return true;
    });
  }, [analysis, dismissedIds, typeFilter]);

  const handleInspectOutlet = (outletName: string) => {
    const normalized = outletName.trim().toLowerCase();
    const matched = outlets.find(
      (o) =>
        o.name.toLowerCase() === normalized ||
        normalized.includes(o.name.toLowerCase()) ||
        o.name.toLowerCase().includes(normalized)
    );
    if (matched) {
      setSelectedOutletId(matched.id);
    }
  };

  const overallMeta = analysis
    ? OVERALL_STATUS_META[analysis.overallStatus] ?? OVERALL_STATUS_META.nominal
    : null;
  const OverallIcon = overallMeta?.icon ?? BellRing;

  return (
    <Card className="bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <BellRing className="w-4 h-4 text-orange-500" />
                AI Sales Anomaly Alerts
              </CardTitle>
              {overallMeta && !error && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-semibold',
                    overallMeta.textClass
                  )}
                >
                  <OverallIcon className="w-3.5 h-3.5" />
                  {overallMeta.label}
                </span>
              )}
              {isLiveFeedPaused && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  Auto-scan paused
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {analysis?.summary ||
                'Real-time AI detection comparing live sales & order bursts against 7-day baselines'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {analysis?.alerts && analysis.alerts.length > 0 && (
              <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-neutral-800 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
                    typeFilter === 'all'
                      ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  All ({analysis.alerts.length - dismissedIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('positive')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
                    typeFilter === 'positive'
                      ? 'bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  Spikes
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('risk')}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
                    typeFilter === 'risk'
                      ? 'bg-white dark:bg-neutral-900 text-rose-700 dark:text-rose-300 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  Drops & Risks
                </button>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void runAnalysis(true)}
              disabled={isLoading}
              className="h-8 gap-1.5 text-xs bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
              <span>{isLoading ? 'Scanning...' : 'Re-scan'}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading && !analysis ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="rounded-xl bg-slate-50/80 dark:bg-neutral-800/50 p-4 space-y-3 animate-pulse"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="h-4 w-24 rounded bg-slate-200 dark:bg-neutral-700" />
                  <div className="h-5 w-16 rounded bg-slate-200 dark:bg-neutral-700" />
                </div>
                <div className="h-4 w-4/5 rounded bg-slate-200 dark:bg-neutral-700" />
                <div className="h-10 w-full rounded bg-slate-200 dark:bg-neutral-700" />
                <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-neutral-700" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl bg-rose-500/5 dark:bg-rose-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Real-time AI Alert Scan Unavailable
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {error}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void runAnalysis(true)}
              disabled={isLoading}
              className="shrink-0 h-8 text-xs border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
            >
              Retry Scan
            </Button>
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {dismissedIds.length > 0
                    ? 'All detected anomalies acknowledged for this scan.'
                    : 'No matching anomalies in the current filter.'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {analysis?.analyzedAt
                    ? `Last AI context scan at ${format(new Date(analysis.analyzedAt), 'HH:mm:ss')}`
                    : 'Click Re-scan to refresh AI anomaly checks.'}
                </p>
              </div>
            </div>
            {dismissedIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDismissedIds([])}
                className="text-xs text-slate-600 dark:text-slate-300"
              >
                Restore {dismissedIds.length} dismissed
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {visibleAlerts.map((alert) => {
                const typeMeta = ALERT_TYPE_META[alert.type] ?? ALERT_TYPE_META.spike;
                const sevMeta = SEVERITY_META[alert.severity] ?? SEVERITY_META.warning;
                const TypeIcon = typeMeta.icon;
                const canInspectOutlet = outlets.some(
                  (o) =>
                    o.name.toLowerCase() === alert.outletName.toLowerCase() ||
                    alert.outletName.toLowerCase().includes(o.name.toLowerCase())
                );

                return (
                  <div
                    key={alert.id}
                    className="rounded-xl bg-slate-50/80 dark:bg-neutral-800/50 p-4 flex flex-col justify-between gap-3 transition-colors hover:bg-slate-100/80 dark:hover:bg-neutral-800/80"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold',
                            sevMeta.badgeClass
                          )}
                        >
                          <TypeIcon className="w-3 h-3" />
                          {typeMeta.label}
                        </span>
                        <span
                          className={cn(
                            'font-mono text-sm font-bold tabular-nums shrink-0',
                            sevMeta.metricClass
                          )}
                        >
                          {alert.metricValue}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {alert.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                            {alert.outletName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono shrink-0">{alert.timeframe}</span>
                        </p>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {alert.explanation}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-slate-200/70 dark:border-neutral-700/60 space-y-2.5">
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          Action:{' '}
                        </span>
                        {alert.recommendedAction}
                      </p>

                      <div className="flex items-center justify-between gap-2">
                        {canInspectOutlet && selectedOutletId === 'all' ? (
                          <button
                            type="button"
                            onClick={() => handleInspectOutlet(alert.outletName)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                          >
                            <span>Filter branch</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {sevMeta.label}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => setDismissedIds((prev) => [...prev, alert.id])}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Acknowledge</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {analysis?.analyzedAt && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400 dark:text-slate-500">
                <span>
                  Context: {telemetry.payload.outletScope} · {telemetry.payload.summary.ordersCount}{' '}
                  orders ({formatCurrency(telemetry.payload.summary.totalSales)})
                </span>
                <span className="font-mono tabular-nums">
                  Last AI scan {format(new Date(analysis.analyzedAt), 'HH:mm:ss')}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
