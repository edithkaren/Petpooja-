/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { Bill } from '@/types';
import { useDashboard } from '@/hooks/use-dashboard';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { LiveOrdersFeed } from '@/components/dashboard/LiveOrdersFeed';
import { BillingAuditFeed } from '@/components/dashboard/BillingAuditFeed';
import { PlatformStats } from '@/components/dashboard/PlatformStats';
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart';
import { WeeklyComparisonChart } from '@/components/dashboard/WeeklyComparisonChart';
import { HourlyOutletsD3Chart } from '@/components/dashboard/HourlyOutletsD3Chart';
import { PeakHoursCard } from '@/components/dashboard/PeakHoursCard';
import { RevenueGrowthGauge } from '@/components/dashboard/RevenueGrowthGauge';
import { SalesAlertsWidget } from '@/components/dashboard/SalesAlertsWidget';
import { motion } from 'motion/react';
import { 
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, subDays } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { addLiveBill, getBills } from '@/lib/mock-data';
import { exportDashboardCsv, exportDashboardPdf } from '@/lib/dashboard-export';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Store, MapPin, ArrowUpRight, Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { formatDateRangeLabel } from '@/components/common/DateRangePicker';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899'];

export const Dashboard: React.FC = () => {
  const { bills, dateRange, refreshData, selectedOutletId, setSelectedOutletId, outlets } = useDashboard();
  const [outletGroupFilter, setOutletGroupFilter] = React.useState<'all' | 'tinkus' | 'indore'>('all');

  const handleSimulateOrder = () => {
    const randomOutlet = outlets.length > 0 ? outlets[Math.floor(Math.random() * outlets.length)].id : 'ot-1';
    const outletId = selectedOutletId === 'all' ? randomOutlet : selectedOutletId;
    const bill = addLiveBill(outletId);
    
    // Force some interesting cases for simulation
    const rand = Math.random();
    if (rand > 0.85) {
      bill.status = 'Cancelled';
      bill.cancellationReason = 'Simulated cancellation';
      bill.payments.forEach(p => p.amount = 0);
    } else if (rand > 0.7) {
      bill.isHighPriority = true;
      bill.total += 5000; // Ensure it's high value
      bill.subtotal += 5000;
    }
    
    refreshData();
  };

  const stats = React.useMemo(() => {
    const totalSales = bills.reduce((acc: number, b: Bill) => acc + b.total, 0);
    const totalBills = bills.length;
    const avgBill = totalBills > 0 ? totalSales / totalBills : 0;
    const totalCovers = bills.reduce((acc: number, b: Bill) => acc + (b.tableNo ? Math.floor(Math.random() * 3) + 2 : 1), 0); // Mocking covers
    
    return {
      grossSales: totalSales,
      billsCount: totalBills,
      avgBillValue: avgBill,
      covers: totalCovers,
      avgSpendPerGuest: totalCovers > 0 ? totalSales / totalCovers : 0,
    };
  }, [bills]);

  const paymentData = React.useMemo(() => {
    const modes: Record<string, number> = {};
    bills.forEach((bill: Bill) => {
      bill.payments.forEach((p) => {
        modes[p.mode] = (modes[p.mode] || 0) + p.amount;
      });
    });
    return Object.entries(modes).map(([name, value]) => ({ name, value }));
  }, [bills]);

  const topItems = React.useMemo(() => {
    const items: Record<string, { name: string, qty: number, revenue: number }> = {};
    bills.forEach((bill: Bill) => {
      bill.items.forEach((item) => {
        if (!items[item.itemId]) {
          items[item.itemId] = { name: item.name, qty: 0, revenue: 0 };
        }
        items[item.itemId].qty += item.qty;
        items[item.itemId].revenue += item.lineTotal;
      });
    });
    return Object.values(items).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [bills]);

  const momGrowth = React.useMemo(() => {
    const now = new Date();
    const currentMonthStart = subDays(now, 30);
    const prevMonthStart = subDays(currentMonthStart, 30);
    
    const outletId = selectedOutletId === 'all' ? undefined : selectedOutletId;
    
    const currentMonthBills = getBills(currentMonthStart, now, outletId);
    const prevMonthBills = getBills(prevMonthStart, currentMonthStart, outletId);
    
    const currentSales = currentMonthBills.reduce((acc, b) => acc + (b.status === 'Cancelled' ? 0 : b.total), 0);
    const prevSales = prevMonthBills.reduce((acc, b) => acc + (b.status === 'Cancelled' ? 0 : b.total), 0);
    
    if (prevSales === 0) return 0;
    return ((currentSales - prevSales) / prevSales) * 100;
  }, [selectedOutletId]);

  const outletSalesBreakdown = React.useMemo(() => {
    const allTodayBills = getBills(dateRange.from, dateRange.to);
    return outlets
      .filter((outlet) => {
        if (outletGroupFilter === 'tinkus') return outlet.name.toLowerCase().includes('tinku');
        if (outletGroupFilter === 'indore') return outlet.city === 'Indore';
        return true;
      })
      .map((outlet) => {
        const outletBills = allTodayBills.filter((b) => b.outletId === outlet.id);
        const activeBills = outletBills.filter((b) => b.status !== 'Cancelled');
        const cancelledCount = outletBills.length - activeBills.length;
        const revenue = activeBills.reduce((acc, b) => acc + b.total, 0);
        const avgBill = activeBills.length > 0 ? revenue / activeBills.length : 0;
        const latestBill = outletBills.reduce<Bill | null>(
          (latest, b) => (!latest || new Date(b.createdAt) > new Date(latest.createdAt) ? b : latest),
          null
        );

        return {
          outlet,
          revenue,
          ordersCount: outletBills.length,
          avgBill,
          cancelledCount,
          lastOrderAt: latestBill ? format(new Date(latestBill.createdAt), 'HH:mm:ss') : '—',
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [outlets, bills, dateRange, outletGroupFilter]);

  const buildExportPayload = () => {
    const selectedOutlet =
      selectedOutletId === 'all'
        ? null
        : outlets.find((o) => o.id === selectedOutletId);

    return {
      outletScopeLabel: selectedOutlet
        ? `${selectedOutlet.name} (${selectedOutlet.city})`
        : `All Outlets (${outlets.length})`,
      dateRangeLabel: formatDateRangeLabel(dateRange.from, dateRange.to),
      selectedOutletId,
      dateRange,
      stats: {
        ...stats,
        momGrowth,
      },
      bills,
      outlets,
      paymentData,
      topItems,
      outletSalesBreakdown,
    };
  };

  const handleExportCsv = () => {
    try {
      const filename = exportDashboardCsv(buildExportPayload());
      toast.success(`Exported CSV locally: ${filename}`);
    } catch {
      toast.error('Unable to export CSV file.');
    }
  };

  const handleExportPdf = () => {
    try {
      const filename = exportDashboardPdf(buildExportPayload());
      toast.success(`Exported PDF locally: ${filename}`);
    } catch {
      toast.error('Unable to export PDF file.');
    }
  };

  const activeOutletLabel = React.useMemo(() => {
    if (selectedOutletId === 'all') return `All Outlets (${outlets.length})`;
    const found = outlets.find((o) => o.id === selectedOutletId);
    return found ? `${found.name} (${found.city})` : 'Selected Outlet';
  }, [selectedOutletId, outlets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Business Overview</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="font-medium text-slate-700 dark:text-slate-200">{activeOutletLabel}</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{formatDateRangeLabel(dateRange.from, dateRange.to)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-9 gap-2 px-3.5 cursor-pointer bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200'
              )}
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 p-1.5">
              <DropdownMenuItem
                onClick={handleExportCsv}
                className="cursor-pointer items-start gap-2.5 px-2.5 py-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Export as CSV
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    KPIs, WoW comparison, outlets & bills
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportPdf}
                className="cursor-pointer items-start gap-2.5 px-2.5 py-2"
              >
                <FileText className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Export as PDF
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Formatted performance report
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            onClick={handleSimulateOrder}
            className="h-9 bg-orange-500 hover:bg-orange-600 text-white gap-2 shadow-lg shadow-orange-200 dark:shadow-none"
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-2 h-2 rounded-full bg-white"
            />
            Simulate New Order
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Gross Sales" value={stats.grossSales} change={12.5} isCurrency />
        <KpiCard title="Bills Count" value={stats.billsCount} change={8.2} />
        <KpiCard title="Avg Bill Value" value={stats.avgBillValue} change={-2.1} isCurrency />
        <KpiCard title="Total Covers" value={stats.covers} change={5.4} />
        <RevenueGrowthGauge growth={momGrowth} />
      </div>

      {/* Real-Time AI Sales Anomaly Alerts */}
      <SalesAlertsWidget />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Main Sales Trend Chart */}
        <SalesTrendChart selectedOutletId={selectedOutletId} />

        {/* Real-Time Billing Audit Side-Panel (Latest 5 Transactions) */}
        <div className="lg:col-span-1">
          <BillingAuditFeed bills={bills} />
        </div>
      </div>

      {/* Secondary Week-over-Week Comparison Chart & Trend Indicator */}
      <WeeklyComparisonChart selectedOutletId={selectedOutletId} />

      {/* D3 Multi-Outlet Hourly Sales Trends for Peak-Time Monitoring */}
      <HourlyOutletsD3Chart />

      {/* Today's Peak Hours Distribution & Busiest Window */}
      <PeakHoursCard selectedOutletId={selectedOutletId} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Modes */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Mode Split</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {paymentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Items */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Items (Revenue)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topItems.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.qty} units sold</p>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums">
                    {formatCurrency(item.revenue)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Live Orders Stream */}
        <div className="lg:col-span-1 h-[390px]">
          <LiveOrdersFeed bills={bills} />
        </div>
      </div>

      <PlatformStats bills={bills} />

      {/* Live Outlet Sales Breakdown */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Store className="w-5 h-5 text-orange-500" />
              Live Outlet Sales Breakdown
            </CardTitle>
            <p className="text-sm text-slate-500">
              Real-time revenue and order counts across Tinku's Cafe & Indore, MP cafes & restaurants (click any outlet to inspect)
            </p>
          </div>
          <Tabs value={outletGroupFilter} onValueChange={(v) => setOutletGroupFilter(v as 'all' | 'tinkus' | 'indore')}>
            <TabsList className="bg-slate-100/70 border border-slate-200">
              <TabsTrigger value="all" className="text-xs px-3">All ({outlets.length})</TabsTrigger>
              <TabsTrigger value="tinkus" className="text-xs px-3">Tinku's Cafe</TabsTrigger>
              <TabsTrigger value="indore" className="text-xs px-3">Indore, MP</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {outletSalesBreakdown.map(({ outlet, revenue, ordersCount, avgBill, cancelledCount, lastOrderAt }) => {
              const isSelected = selectedOutletId === outlet.id;
              return (
                <button
                  key={outlet.id}
                  type="button"
                  onClick={() => setSelectedOutletId(isSelected ? 'all' : outlet.id)}
                  className={cn(
                    "text-left p-4 rounded-xl border transition-all group",
                    isSelected
                      ? "border-orange-400 bg-orange-50/50 ring-1 ring-orange-200"
                      : "border-slate-200 bg-white hover:border-orange-200 hover:shadow-sm"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate group-hover:text-orange-600 transition-colors">
                        {outlet.name}
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {outlet.city}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] shrink-0 gap-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-lg font-bold text-slate-900 tabular-nums">
                      {formatCurrency(revenue)}
                    </span>
                    <span className="text-xs text-slate-500 font-medium tabular-nums">
                      {ordersCount} orders
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="tabular-nums">Avg: {formatCurrency(avgBill)}</span>
                    <span className="flex items-center gap-1 font-mono">
                      {cancelledCount > 0 && (
                        <span className="text-rose-500 mr-1">{cancelledCount} canc.</span>
                      )}
                      {lastOrderAt}
                      <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-orange-500" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
