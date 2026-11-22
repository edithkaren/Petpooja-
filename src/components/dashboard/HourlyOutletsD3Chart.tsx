/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import * as d3 from 'd3';
import { endOfDay, isSameDay, startOfDay } from 'date-fns';
import { Activity, Clock, Flame, Store } from 'lucide-react';

import { Bill, Outlet } from '@/types';
import { getBills } from '@/lib/mock-data';
import { useDashboard } from '@/hooks/use-dashboard';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateRangeLabel } from '@/components/common/DateRangePicker';

type OutletScopeGroup = 'top6' | 'tinkus' | 'indore' | 'all';
type MetricMode = 'revenue' | 'orders';

interface HourlyPoint {
  hour: number;
  hourLabel: string;
  revenue: number;
  orders: number;
}

interface OutletHourlySeries {
  outlet: Outlet;
  points: HourlyPoint[];
  totalRevenue: number;
  totalOrders: number;
  peakHour: number;
  peakValue: number;
  color: string;
}

interface HoverSnapshot {
  hour: number;
  hourLabel: string;
  xPos: number;
  rows: Array<{
    outletId: string;
    outletName: string;
    color: string;
    value: number;
    revenue: number;
    orders: number;
  }>;
  networkTotal: number;
}

const SERIES_PALETTE = [
  '#f97316', // orange-500
  '#2563eb', // blue-600
  '#059669', // emerald-600
  '#9333ea', // purple-600
  '#e11d48', // rose-600
  '#0891b2', // cyan-600
  '#d97706', // amber-600
  '#4f46e5', // indigo-600
  '#0d9488', // teal-600
  '#db2777', // pink-600
  '#65a30d', // lime-600
  '#7c3aed', // violet-600
];

const START_HOUR = 8;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

const formatHourLabel = (hour: number): string => `${hour.toString().padStart(2, '0')}:00`;

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = React.useState<boolean>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export const HourlyOutletsD3Chart: React.FC = () => {
  const { outlets, bills, dateRange, selectedOutletId, setSelectedOutletId } = useDashboard();
  const isDark = useIsDarkMode();

  const [scopeGroup, setScopeGroup] = React.useState<OutletScopeGroup>('top6');
  const [metric, setMetric] = React.useState<MetricMode>('revenue');
  const [hoveredOutletId, setHoveredOutletId] = React.useState<string | null>(null);
  const [pinnedOutletId, setPinnedOutletId] = React.useState<string | null>(null);
  const [hoverSnapshot, setHoverSnapshot] = React.useState<HoverSnapshot | null>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(860);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  // Measure container width cleanly for responsive D3 SVG layout
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = el.getBoundingClientRect().width;
      if (next > 0) setContainerWidth(Math.floor(next));
    };
    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Build hourly series across all outlets in the active dateRange (reacts to live bills too)
  const {
    visibleSeries,
    allOutletsCount,
    tinkusCount,
    indoreOtherCount,
    networkPeakHour,
    networkPeakRevenue,
    networkPeakOrders,
    topBranchPeak,
    totalDisplayedRevenue,
    totalDisplayedOrders,
    isSingleDay,
    maxHourlyHourLimit,
  } = React.useMemo(() => {
    const now = new Date();
    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = endOfDay(dateRange.to);
    const singleDay = isSameDay(rangeStart, rangeEnd);
    const isTodayOnly = singleDay && isSameDay(rangeStart, now);
    const maxHour = isTodayOnly ? Math.max(START_HOUR, Math.min(END_HOUR, now.getHours())) : END_HOUR;

    // Always fetch across all outlets so peak monitoring spans the entire branch network
    const allRangeBills: Bill[] = getBills(rangeStart, rangeEnd);

    const byOutlet = new Map<string, Bill[]>();
    allRangeBills.forEach((b) => {
      if (b.status === 'Cancelled') return;
      const list = byOutlet.get(b.outletId);
      if (list) list.push(b);
      else byOutlet.set(b.outletId, [b]);
    });

    const activeHours = HOURS.filter((h) => h <= maxHour);

    const fullSeries: OutletHourlySeries[] = outlets.map((outlet, idx) => {
      const outletBills = byOutlet.get(outlet.id) || [];
      const revenueByHour = new Map<number, number>();
      const ordersByHour = new Map<number, number>();

      outletBills.forEach((bill) => {
        const rawHour = new Date(bill.createdAt).getHours();
        const hr = Math.max(START_HOUR, Math.min(END_HOUR, rawHour));
        revenueByHour.set(hr, (revenueByHour.get(hr) || 0) + bill.total);
        ordersByHour.set(hr, (ordersByHour.get(hr) || 0) + 1);
      });

      const points: HourlyPoint[] = activeHours.map((hour) => ({
        hour,
        hourLabel: formatHourLabel(hour),
        revenue: Math.round(revenueByHour.get(hour) || 0),
        orders: ordersByHour.get(hour) || 0,
      }));

      let totalRevenue = 0;
      let totalOrders = 0;
      let peakHour = activeHours[0] ?? START_HOUR;
      let peakVal = -1;

      points.forEach((p) => {
        totalRevenue += p.revenue;
        totalOrders += p.orders;
        const val = metric === 'revenue' ? p.revenue : p.orders;
        if (val > peakVal) {
          peakVal = val;
          peakHour = p.hour;
        }
      });

      return {
        outlet,
        points,
        totalRevenue,
        totalOrders,
        peakHour,
        peakValue: Math.max(0, peakVal),
        color: SERIES_PALETTE[idx % SERIES_PALETTE.length],
      };
    });

    // Filter according to selected branch scope group
    let filtered = fullSeries;
    if (scopeGroup === 'tinkus') {
      filtered = fullSeries.filter((s) => s.outlet.name.toLowerCase().includes('tinku'));
    } else if (scopeGroup === 'indore') {
      filtered = fullSeries.filter(
        (s) => s.outlet.city === 'Indore' && !s.outlet.name.toLowerCase().includes('tinku')
      );
    } else if (scopeGroup === 'top6') {
      const sorted = [...fullSeries].sort((a, b) => b.totalRevenue - a.totalRevenue);
      const top = sorted.slice(0, 6);
      // Keep header-selected outlet visible if it isn't already in top 6
      if (
        selectedOutletId !== 'all' &&
        !top.some((s) => s.outlet.id === selectedOutletId)
      ) {
        const selectedSeries = fullSeries.find((s) => s.outlet.id === selectedOutletId);
        if (selectedSeries) {
          filtered = [...top.slice(0, 5), selectedSeries];
        } else {
          filtered = top;
        }
      } else {
        filtered = top;
      }
    }

    // Re-assign crisp distinct palette colors across the visible set when <= 12
    const coloredSeries = filtered
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .map((s, idx) => ({
        ...s,
        color: SERIES_PALETTE[idx % SERIES_PALETTE.length],
      }));

    // Compute network peak hour across the displayed outlets
    const networkRevByHour = new Map<number, number>();
    const networkOrdByHour = new Map<number, number>();

    coloredSeries.forEach((s) => {
      s.points.forEach((p) => {
        networkRevByHour.set(p.hour, (networkRevByHour.get(p.hour) || 0) + p.revenue);
        networkOrdByHour.set(p.hour, (networkOrdByHour.get(p.hour) || 0) + p.orders);
      });
    });

    let bestHour = activeHours[0] ?? START_HOUR;
    let bestHourMetric = -1;
    let bestHourRev = 0;
    let bestHourOrd = 0;

    activeHours.forEach((hr) => {
      const rev = networkRevByHour.get(hr) || 0;
      const ord = networkOrdByHour.get(hr) || 0;
      const checkVal = metric === 'revenue' ? rev : ord;
      if (checkVal > bestHourMetric) {
        bestHourMetric = checkVal;
        bestHour = hr;
        bestHourRev = rev;
        bestHourOrd = ord;
      }
    });

    // Top single branch-hour spike
    let topBranch: { name: string; hour: number; value: number; revenue: number; orders: number } | null = null;
    coloredSeries.forEach((s) => {
      s.points.forEach((p) => {
        const val = metric === 'revenue' ? p.revenue : p.orders;
        if (!topBranch || val > topBranch.value) {
          topBranch = {
            name: s.outlet.name,
            hour: p.hour,
            value: val,
            revenue: p.revenue,
            orders: p.orders,
          };
        }
      });
    });

    const totalRev = coloredSeries.reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalOrd = coloredSeries.reduce((sum, s) => sum + s.totalOrders, 0);

    return {
      visibleSeries: coloredSeries,
      allOutletsCount: outlets.length,
      tinkusCount: outlets.filter((o) => o.name.toLowerCase().includes('tinku')).length,
      indoreOtherCount: outlets.filter(
        (o) => o.city === 'Indore' && !o.name.toLowerCase().includes('tinku')
      ).length,
      networkPeakHour: bestHour,
      networkPeakRevenue: bestHourRev,
      networkPeakOrders: bestHourOrd,
      topBranchPeak: topBranch as {
        name: string;
        hour: number;
        value: number;
        revenue: number;
        orders: number;
      } | null,
      totalDisplayedRevenue: totalRev,
      totalDisplayedOrders: totalOrd,
      isSingleDay: singleDay,
      maxHourlyHourLimit: maxHour,
    };
  }, [outlets, bills, dateRange, scopeGroup, metric, selectedOutletId]);

  const activeFocusOutletId =
    hoveredOutletId || pinnedOutletId || (selectedOutletId !== 'all' ? selectedOutletId : null);

  // D3 SVG rendering & interactive pointer tracking
  React.useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const activeHours = HOURS.filter((h) => h <= maxHourlyHourLimit);
    if (visibleSeries.length === 0 || activeHours.length === 0) {
      return;
    }

    const height = 340;
    const width = Math.max(320, containerWidth);
    const margin = { top: 26, right: 20, bottom: 36, left: metric === 'revenue' ? 62 : 44 };
    const innerWidth = Math.max(120, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xDomain: [number, number] = [
      activeHours[0],
      activeHours.length > 1 ? activeHours[activeHours.length - 1] : activeHours[0] + 1,
    ];
    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerWidth]);

    const maxPointValue =
      d3.max(visibleSeries, (s) =>
        d3.max(s.points, (p) => (metric === 'revenue' ? p.revenue : p.orders))
      ) ?? 0;
    const yMax = Math.max(metric === 'revenue' ? 500 : 5, maxPointValue * 1.14);
    const yScale = d3.scaleLinear().domain([0, yMax]).nice(5).range([innerHeight, 0]);

    const gridStroke = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
    const axisText = isDark ? '#94a3b8' : '#64748b';
    const peakFill = isDark ? 'rgba(249, 115, 22, 0.14)' : 'rgba(249, 115, 22, 0.08)';
    const peakStroke = isDark ? 'rgba(251, 146, 60, 0.45)' : 'rgba(249, 115, 22, 0.35)';
    const crosshairColor = isDark ? 'rgba(226, 232, 240, 0.35)' : 'rgba(15, 23, 42, 0.25)';
    const dotStroke = isDark ? '#171717' : '#ffffff';

    // Horizontal grid lines
    const yTicks = yScale.ticks(5);
    g.append('g')
      .attr('class', 'd3-grid')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', gridStroke)
      .attr('stroke-dasharray', '3,3');

    // Highlight Peak Hour monitoring window band
    if (activeHours.length > 1 && totalDisplayedOrders > 0) {
      const stepPx = innerWidth / Math.max(1, activeHours.length - 1);
      const bandWidth = Math.max(24, Math.min(54, stepPx * 0.72));
      const peakX = xScale(networkPeakHour);
      const clampedX = Math.max(0, Math.min(innerWidth - bandWidth, peakX - bandWidth / 2));

      g.append('rect')
        .attr('x', clampedX)
        .attr('y', 0)
        .attr('width', bandWidth)
        .attr('height', innerHeight)
        .attr('rx', 6)
        .attr('fill', peakFill)
        .attr('stroke', peakStroke)
        .attr('stroke-dasharray', '3,3');

      g.append('text')
        .attr('x', Math.max(28, Math.min(innerWidth - 28, peakX)))
        .attr('y', -9)
        .attr('text-anchor', 'middle')
        .attr('fill', isDark ? '#fb923c' : '#ea580c')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
        .text(`Peak ${formatHourLabel(networkPeakHour)}`);
    }

    // X Axis
    const tickStep = width < 560 ? 3 : width < 780 ? 2 : 1;
    const xTickValues = activeHours.filter((_, idx) => idx % tickStep === 0);
    const xAxis = d3
      .axisBottom(xScale)
      .tickValues(xTickValues)
      .tickFormat((d) => formatHourLabel(Number(d)))
      .tickSizeOuter(0);

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.select('.domain').attr('stroke', gridStroke);
    xAxisG.selectAll('.tick line').attr('stroke', gridStroke);
    xAxisG
      .selectAll('.tick text')
      .attr('fill', axisText)
      .attr('font-size', '11px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .attr('dy', '0.9em');

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) =>
        metric === 'revenue' ? `₹${formatNumber(Number(d))}` : `${Math.round(Number(d))}`
      )
      .tickSize(0);

    const yAxisG = g.append('g').call(yAxis);
    yAxisG.select('.domain').remove();
    yAxisG
      .selectAll('.tick text')
      .attr('fill', axisText)
      .attr('font-size', '11px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .attr('dx', '-0.4em');

    // Line generator
    const lineGenerator = d3
      .line<HourlyPoint>()
      .x((d) => xScale(d.hour))
      .y((d) => yScale(metric === 'revenue' ? d.revenue : d.orders))
      .curve(d3.curveMonotoneX);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const linesGroup = g.append('g').attr('class', 'd3-outlet-lines');

    visibleSeries.forEach((series) => {
      const isFocused = activeFocusOutletId === series.outlet.id;
      const isDimmed = activeFocusOutletId !== null && !isFocused;
      const baseOpacity = scopeGroup === 'all' ? 0.52 : 0.9;
      const strokeOpacity = isFocused ? 1 : isDimmed ? 0.14 : baseOpacity;
      const strokeWidth = isFocused ? 3 : scopeGroup === 'all' ? 1.6 : 2.25;

      const path = linesGroup
        .append('path')
        .datum(series.points)
        .attr('fill', 'none')
        .attr('stroke', series.color)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-opacity', strokeOpacity)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('d', lineGenerator);

      if (!prefersReducedMotion && scopeGroup !== 'all') {
        const totalLength = path.node()?.getTotalLength() ?? 0;
        if (totalLength > 0) {
          path
            .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
            .attr('stroke-dashoffset', totalLength)
            .transition()
            .duration(420)
            .ease(d3.easeCubicOut)
            .attr('stroke-dashoffset', 0)
            .on('end', () => {
              path.attr('stroke-dasharray', null);
            });
        }
      }

      // Peak marker dot on focused or top series
      if (isFocused || (scopeGroup !== 'all' && activeFocusOutletId === null)) {
        const peakPoint = series.points.find((p) => p.hour === series.peakHour);
        if (peakPoint && (metric === 'revenue' ? peakPoint.revenue : peakPoint.orders) > 0) {
          linesGroup
            .append('circle')
            .attr('cx', xScale(peakPoint.hour))
            .attr('cy', yScale(metric === 'revenue' ? peakPoint.revenue : peakPoint.orders))
            .attr('r', isFocused ? 4.5 : 3)
            .attr('fill', series.color)
            .attr('stroke', dotStroke)
            .attr('stroke-width', 1.5);
        }
      }
    });

    // Crosshair & active-hour dots layer
    const hoverLayer = g.append('g').style('display', 'none');
    const crosshair = hoverLayer
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', crosshairColor)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    const hoverDotsGroup = hoverLayer.append('g');

    const bisectHour = d3.bisector<number, number>((h) => h).center;

    const handlePointerMove = (event: PointerEvent) => {
      const [mx] = d3.pointer(event);
      const hoveredHourFloat = xScale.invert(mx);
      const idx = Math.max(
        0,
        Math.min(activeHours.length - 1, bisectHour(activeHours, hoveredHourFloat))
      );
      const snappedHour = activeHours[idx];
      const snappedX = xScale(snappedHour);

      hoverLayer.style('display', null);
      crosshair.attr('x1', snappedX).attr('x2', snappedX);

      const rows = visibleSeries
        .map((s) => {
          const pt = s.points.find((p) => p.hour === snappedHour);
          const revenue = pt?.revenue ?? 0;
          const orders = pt?.orders ?? 0;
          return {
            outletId: s.outlet.id,
            outletName: s.outlet.name,
            color: s.color,
            value: metric === 'revenue' ? revenue : orders,
            revenue,
            orders,
          };
        })
        .sort((a, b) => b.value - a.value);

      hoverDotsGroup
        .selectAll('circle')
        .data(rows)
        .join('circle')
        .attr('cx', snappedX)
        .attr('cy', (d) => yScale(d.value))
        .attr('r', (d) => (activeFocusOutletId === d.outletId ? 5 : 3.5))
        .attr('fill', (d) => d.color)
        .attr('stroke', dotStroke)
        .attr('stroke-width', 1.5)
        .attr('opacity', (d) =>
          activeFocusOutletId && activeFocusOutletId !== d.outletId ? 0.25 : 1
        );

      const networkTotal = rows.reduce((sum, r) => sum + r.value, 0);

      setHoverSnapshot({
        hour: snappedHour,
        hourLabel: formatHourLabel(snappedHour),
        xPos: margin.left + snappedX,
        rows,
        networkTotal,
      });
    };

    const handlePointerLeave = () => {
      hoverLayer.style('display', 'none');
      setHoverSnapshot(null);
    };

    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('pointermove', handlePointerMove)
      .on('pointerleave', handlePointerLeave);
  }, [
    visibleSeries,
    containerWidth,
    metric,
    isDark,
    activeFocusOutletId,
    scopeGroup,
    networkPeakHour,
    totalDisplayedOrders,
    maxHourlyHourLimit,
  ]);

  const togglePinOutlet = (outletId: string) => {
    setPinnedOutletId((prev) => (prev === outletId ? null : outletId));
  };

  return (
    <Card className="bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 shadow-sm">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-500" />
                Hourly Sales Trends Across All Outlets
              </CardTitle>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                <span aria-hidden="true">· </span>
                {formatDateRangeLabel(dateRange.from, dateRange.to)}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              D3 multi-branch hourly curves ({formatHourLabel(START_HOUR)}–
              {formatHourLabel(maxHourlyHourLimit)}) for real-time peak-time monitoring across{' '}
              {allOutletsCount} outlets
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Metric Segmented Switch */}
            <div
              className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-neutral-800 p-0.5 text-xs"
              role="group"
              aria-label="Chart metric"
            >
              <button
                type="button"
                onClick={() => setMetric('revenue')}
                className={cn(
                  'px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  metric === 'revenue'
                    ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                Revenue (₹)
              </button>
              <button
                type="button"
                onClick={() => setMetric('orders')}
                className={cn(
                  'px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  metric === 'orders'
                    ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                Order Volume
              </button>
            </div>

            {/* Outlet Cohort Filter */}
            <div
              className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-neutral-800 p-0.5 text-xs"
              role="group"
              aria-label="Outlet cohort"
            >
              {(
                [
                  { id: 'top6', label: 'Top 6' },
                  { id: 'tinkus', label: `Tinku's (${tinkusCount})` },
                  { id: 'indore', label: `Indore, MP (${indoreOtherCount})` },
                  { id: 'all', label: `All (${allOutletsCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setScopeGroup(tab.id);
                    setPinnedOutletId(null);
                  }}
                  className={cn(
                    'px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    scopeGroup === tab.id
                      ? 'bg-white dark:bg-neutral-900 text-orange-600 dark:text-orange-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Peak Monitoring Summary Strip */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-neutral-800">
          <div className="flex items-start gap-2.5">
            <Flame className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">Network Peak Window</p>
              <p className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                {formatHourLabel(networkPeakHour)}–{formatHourLabel((networkPeakHour + 1) % 24)} ·{' '}
                {metric === 'revenue'
                  ? formatCurrency(networkPeakRevenue)
                  : `${networkPeakOrders} orders`}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Store className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">Highest Branch Spike</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                {topBranchPeak ? (
                  <>
                    <span>{topBranchPeak.name}</span>
                    <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 ml-1.5">
                      @ {formatHourLabel(topBranchPeak.hour)} (
                      {metric === 'revenue'
                        ? formatCurrency(topBranchPeak.revenue)
                        : `${topBranchPeak.orders} orders`}
                      )
                    </span>
                  </>
                ) : (
                  '—'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Plotted Scope ({visibleSeries.length} outlets)
              </p>
              <p className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                {formatCurrency(totalDisplayedRevenue)} · {totalDisplayedOrders.toLocaleString('en-IN')} orders
                {!isSingleDay ? ' (range sum)' : ''}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {visibleSeries.length === 0 || totalDisplayedOrders === 0 ? (
          <div className="h-[340px] flex flex-col items-center justify-center text-center gap-2 text-slate-500 dark:text-slate-400">
            <Activity className="w-6 h-6 text-slate-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              No hourly transactions recorded in this range
            </p>
            <p className="text-xs max-w-md">
              Switch the date range or click Simulate New Order to stream real-time branch sales into
              the D3 hourly monitor.
            </p>
          </div>
        ) : (
          <>
            {/* Interactive D3 Canvas Container */}
            <div ref={containerRef} className="relative w-full select-none">
              <svg
                ref={svgRef}
                role="img"
                aria-label="D3 hourly sales trend line chart across outlets"
                className="w-full h-[340px] overflow-visible"
              />

              {/* Floating D3 Crosshair Tooltip */}
              {hoverSnapshot && (
                <div
                  className="pointer-events-none absolute top-2 z-20 w-64 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xs p-3 shadow-lg text-xs"
                  style={{
                    left:
                      hoverSnapshot.xPos > containerWidth * 0.62
                        ? Math.max(8, hoverSnapshot.xPos - 270)
                        : Math.min(containerWidth - 264, hoverSnapshot.xPos + 14),
                  }}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-neutral-800">
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {hoverSnapshot.hourLabel} – {formatHourLabel((hoverSnapshot.hour + 1) % 24)}
                    </span>
                    <span className="font-mono font-bold tabular-nums text-orange-600 dark:text-orange-400">
                      {metric === 'revenue'
                        ? formatCurrency(hoverSnapshot.networkTotal)
                        : `${hoverSnapshot.networkTotal} orders`}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {hoverSnapshot.rows.slice(0, 6).map((row) => (
                      <div key={row.outletId} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                          <span
                            className={cn(
                              'truncate',
                              activeFocusOutletId === row.outletId
                                ? 'font-semibold text-slate-900 dark:text-slate-100'
                                : 'text-slate-600 dark:text-slate-300'
                            )}
                          >
                            {row.outletName}
                          </span>
                        </div>
                        <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 shrink-0">
                          {metric === 'revenue'
                            ? formatCurrency(row.revenue)
                            : `${row.orders} bills`}
                        </span>
                      </div>
                    ))}
                    {hoverSnapshot.rows.length > 6 && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
                        +{hoverSnapshot.rows.length - 6} more outlets in cohort
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Outlet Legend & Isolate Controls */}
            <div className="pt-2 border-t border-slate-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {visibleSeries.map((series) => {
                  const isPinned = pinnedOutletId === series.outlet.id;
                  const isHeaderActive = selectedOutletId === series.outlet.id;
                  const isDimmed =
                    activeFocusOutletId !== null && activeFocusOutletId !== series.outlet.id;

                  return (
                    <button
                      key={series.outlet.id}
                      type="button"
                      onMouseEnter={() => setHoveredOutletId(series.outlet.id)}
                      onMouseLeave={() => setHoveredOutletId(null)}
                      onClick={() => togglePinOutlet(series.outlet.id)}
                      title={`Click to isolate ${series.outlet.name} · Peak ${formatHourLabel(series.peakHour)}`}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-opacity cursor-pointer whitespace-nowrap',
                        isPinned || isHeaderActive
                          ? 'bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-300 dark:ring-neutral-600'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-neutral-800/60',
                        isDimmed && 'opacity-40'
                      )}
                    >
                      <span
                        className="w-2.5 h-0.5 rounded-full shrink-0"
                        style={{ backgroundColor: series.color }}
                      />
                      <span className="max-w-[165px] truncate">{series.outlet.name}</span>
                      <span className="font-mono tabular-nums text-[10px] text-slate-400 dark:text-slate-500">
                        {formatHourLabel(series.peakHour)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                {pinnedOutletId && (
                  <button
                    type="button"
                    onClick={() => setSelectedOutletId(pinnedOutletId)}
                    className="font-medium text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                  >
                    Filter dashboard to outlet
                  </button>
                )}
                {pinnedOutletId && (
                  <button
                    type="button"
                    onClick={() => setPinnedOutletId(null)}
                    className="font-medium text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                  >
                    Clear pin
                  </button>
                )}
                {!pinnedOutletId && (
                  <span>Hover or click a branch to isolate its curve</span>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
