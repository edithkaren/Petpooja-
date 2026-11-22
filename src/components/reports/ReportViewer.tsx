/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, isWithinInterval } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Download,
  FileSpreadsheet,
  Store,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { useDashboard } from "@/hooks/use-dashboard";
import { CUSTOMERS, getBills, ITEMS, STAFF } from "@/lib/mock-data";
import { Bill, StockTransfer } from "@/types";
import { DataTable } from "@/components/common/DataTable";
import { formatDateRangeLabel } from "@/components/common/DateRangePicker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";

export type ReportId =
  | "daily-sales"
  | "outlet-comp"
  | "hourly-sales"
  | "order-type"
  | "top-items"
  | "slow-items"
  | "cat-sales"
  | "pm-split"
  | "tax-summary"
  | "discounts"
  | "staff-perf"
  | "cust-loyalty"
  | "low-stock"
  | "stock-transfers";

export type ReportTimeframe = "today" | "7d" | "30d" | "90d" | "custom";

export interface ReportMeta {
  id: ReportId;
  name: string;
  desc: string;
  group: string;
  isFavorite?: boolean;
}

interface ReportSummaryMetric {
  label: string;
  value: string;
  hint?: string;
}

interface ReportViewerProps {
  report: ReportMeta;
  allReports: ReportMeta[];
  timeframe: ReportTimeframe;
  onTimeframeChange: (tf: ReportTimeframe) => void;
  onSelectReport: (id: ReportId) => void;
  onBack: () => void;
}

const CHART_COLORS = [
  "#f97316",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#eab308",
  "#06b6d4",
];

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (val: string | number) => {
    const str = String(val ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const ReportViewer: React.FC<ReportViewerProps> = ({
  report,
  allReports,
  timeframe,
  onTimeframeChange,
  onSelectReport,
  onBack,
}) => {
  const {
    bills: reportBills,
    dateRange,
    outlets,
    selectedOutletId,
    stockItems,
    stockTransfers,
  } = useDashboard();

  const validBills = React.useMemo(
    () => reportBills.filter((b) => b.status !== "Cancelled"),
    [reportBills]
  );

  const outletMap = React.useMemo(() => {
    const map = new Map<string, { name: string; city: string }>();
    outlets.forEach((o) => map.set(o.id, { name: o.name, city: o.city }));
    return map;
  }, [outlets]);

  const activeOutletLabel =
    selectedOutletId === "all"
      ? `All Outlets (${outlets.length})`
      : outletMap.get(selectedOutletId)?.name || "Selected Outlet";

  const timeframeLabel = formatDateRangeLabel(dateRange.from, dateRange.to);

  // Build report-specific metrics, chart, table data & CSV payload
  const builtReport = React.useMemo(() => {
    const totalNetSales = validBills.reduce((s, b) => s + b.total, 0);
    const totalSubtotal = validBills.reduce((s, b) => s + b.subtotal, 0);
    const totalTax = validBills.reduce((s, b) => s + b.tax, 0);
    const totalDiscount = validBills.reduce((s, b) => s + b.discount, 0);

    switch (report.id) {
      case "daily-sales": {
        const byDay = new Map<
          string,
          { dateKey: string; label: string; bills: number; subtotal: number; tax: number; discount: number; netSales: number }
        >();
        validBills.forEach((b) => {
          const d = new Date(b.createdAt);
          const dateKey = format(d, "yyyy-MM-dd");
          const existing = byDay.get(dateKey) || {
            dateKey,
            label: format(d, "dd MMM"),
            bills: 0,
            subtotal: 0,
            tax: 0,
            discount: 0,
            netSales: 0,
          };
          existing.bills += 1;
          existing.subtotal += b.subtotal;
          existing.tax += b.tax;
          existing.discount += b.discount;
          existing.netSales += b.total;
          byDay.set(dateKey, existing);
        });
        const rows = Array.from(byDay.values()).sort((a, b) =>
          a.dateKey.localeCompare(b.dateKey)
        );
        const avgDaily = rows.length > 0 ? totalNetSales / rows.length : 0;

        const columns: ColumnDef<(typeof rows)[0], unknown>[] = [
          { accessorKey: "label", header: "Date", cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.dateKey}</span> },
          { accessorKey: "bills", header: "Bills", cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.bills}</span> },
          { accessorKey: "subtotal", header: "Gross Subtotal", cell: ({ row }) => <span className="font-mono tabular-nums">{formatCurrency(row.original.subtotal)}</span> },
          { accessorKey: "discount", header: "Discounts", cell: ({ row }) => <span className="font-mono tabular-nums text-rose-600">{formatCurrency(row.original.discount)}</span> },
          { accessorKey: "tax", header: "GST Tax", cell: ({ row }) => <span className="font-mono tabular-nums text-slate-600">{formatCurrency(row.original.tax)}</span> },
          { accessorKey: "netSales", header: "Net Sales", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-slate-900">{formatCurrency(row.original.netSales)}</span> },
        ];

        return {
          metrics: [
            { label: "Total Net Sales", value: formatCurrency(totalNetSales), hint: timeframeLabel },
            { label: "Total Bills", value: validBills.length.toLocaleString("en-IN"), hint: `${rows.length} active day(s)` },
            { label: "Avg Daily Revenue", value: formatCurrency(avgDaily), hint: "Per operating day" },
            { label: "Avg Ticket Size", value: formatCurrency(validBills.length ? totalNetSales / validBills.length : 0) },
          ] as ReportSummaryMetric[],
          chartType: "area" as const,
          chartTitle: "Daily Revenue Trend",
          chartData: rows.map((r) => ({ name: r.label, value: Math.round(r.netSales), secondary: r.bills })),
          chartSeriesLabel: "Net Sales",
          columns,
          rows: [...rows].reverse(),
          csvHeaders: ["Date", "Bills", "Gross Subtotal", "Discounts", "GST Tax", "Net Sales"],
          csvRows: rows.map((r) => [r.dateKey, r.bills, Math.round(r.subtotal), Math.round(r.discount), Math.round(r.tax), Math.round(r.netSales)]),
        };
      }

      case "outlet-comp": {
        const byOutlet = new Map<
          string,
          { outletId: string; name: string; city: string; bills: number; netSales: number; avgTicket: number; share: number }
        >();
        outlets.forEach((o) => {
          byOutlet.set(o.id, { outletId: o.id, name: o.name, city: o.city, bills: 0, netSales: 0, avgTicket: 0, share: 0 });
        });
        validBills.forEach((b) => {
          const entry = byOutlet.get(b.outletId);
          if (entry) {
            entry.bills += 1;
            entry.netSales += b.total;
          }
        });
        const rows = Array.from(byOutlet.values())
          .filter((r) => selectedOutletId === "all" || r.outletId === selectedOutletId)
          .map((r) => ({
            ...r,
            avgTicket: r.bills > 0 ? r.netSales / r.bills : 0,
            share: totalNetSales > 0 ? (r.netSales / totalNetSales) * 100 : 0,
          }))
          .sort((a, b) => b.netSales - a.netSales);

        const topOutlet = rows[0];
        const columns: ColumnDef<(typeof rows)[0], unknown>[] = [
          {
            accessorKey: "name",
            header: "Outlet",
            cell: ({ row }) => (
              <div className="flex items-center gap-2">
                <Store className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="font-medium text-slate-900">{row.original.name}</span>
              </div>
            ),
          },
          { accessorKey: "city", header: "City", cell: ({ row }) => <Badge variant="outline" className="text-xs">{row.original.city}</Badge> },
          { accessorKey: "bills", header: "Orders", cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.bills}</span> },
          { accessorKey: "avgTicket", header: "Avg Ticket", cell: ({ row }) => <span className="font-mono tabular-nums">{formatCurrency(row.original.avgTicket)}</span> },
          { accessorKey: "share", header: "Share %", cell: ({ row }) => <span className="font-mono tabular-nums text-slate-600">{row.original.share.toFixed(1)}%</span> },
          { accessorKey: "netSales", header: "Net Revenue", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-slate-900">{formatCurrency(row.original.netSales)}</span> },
        ];

        return {
          metrics: [
            { label: "Top Performing Outlet", value: topOutlet?.name.split(" - ")[0] || "N/A", hint: topOutlet ? formatCurrency(topOutlet.netSales) : "" },
            { label: "Outlets Tracked", value: String(rows.length), hint: activeOutletLabel },
            { label: "Combined Revenue", value: formatCurrency(totalNetSales), hint: timeframeLabel },
            { label: "Combined Orders", value: validBills.length.toLocaleString("en-IN") },
          ] as ReportSummaryMetric[],
          chartType: "bar" as const,
          chartTitle: "Top 10 Outlets by Net Revenue",
          chartData: rows.slice(0, 10).map((r) => ({
            name: r.name.replace("Tinku's Cafe - ", "Tinku's "),
            value: Math.round(r.netSales),
            secondary: r.bills,
          })),
          chartSeriesLabel: "Net Revenue",
          columns,
          rows,
          csvHeaders: ["Outlet", "City", "Orders", "Avg Ticket", "Share %", "Net Revenue"],
          csvRows: rows.map((r) => [r.name, r.city, r.bills, Math.round(r.avgTicket), r.share.toFixed(1), Math.round(r.netSales)]),
        };
      }

      case "hourly-sales": {
        const hours = Array.from({ length: 16 }, (_, idx) => idx + 8); // 08:00 to 23:00
        const hourBuckets = new Map<number, { hour: number; label: string; bills: number; netSales: number }>();
        hours.forEach((h) => {
          hourBuckets.set(h, { hour: h, label: `${String(h).padStart(2, "0")}:00`, bills: 0, netSales: 0 });
        });
        validBills.forEach((b) => {
          const h = new Date(b.createdAt).getHours();
          const bucket = hourBuckets.get(h);
          if (bucket) {
            bucket.bills += 1;
            bucket.netSales += b.total;
          }
        });
        const rows = Array.from(hourBuckets.values()).map((r) => ({
          ...r,
          avgTicket: r.bills > 0 ? r.netSales / r.bills : 0,
          share: totalNetSales > 0 ? (r.netSales / totalNetSales) * 100 : 0,
        }));
        const peak = [...rows].sort((a, b) => b.netSales - a.netSales)[0];

        const columns: ColumnDef<(typeof rows)[0], unknown>[] = [
          { accessorKey: "label", header: "Hour Window", cell: ({ row }) => <span className="font-mono font-medium text-slate-900">{row.original.label}</span> },
          { accessorKey: "bills", header: "Orders", cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.bills}</span> },
          { accessorKey: "avgTicket", header: "Avg Ticket", cell: ({ row }) => <span className="font-mono tabular-nums">{formatCurrency(row.original.avgTicket)}</span> },
          { accessorKey: "share", header: "Share %", cell: ({ row }) => <span className="font-mono tabular-nums text-slate-600">{row.original.share.toFixed(1)}%</span> },
          { accessorKey: "netSales", header: "Revenue", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-slate-900">{formatCurrency(row.original.netSales)}</span> },
        ];

        return {
          metrics: [
            { label: "Peak Revenue Hour", value: peak?.label || "N/A", hint: peak ? formatCurrency(peak.netSales) : "" },
            { label: "Peak Orders Hour", value: `${[...rows].sort((a, b) => b.bills - a.bills)[0]?.label || "N/A"}`, hint: `${[...rows].sort((a, b) => b.bills - a.bills)[0]?.bills || 0} orders` },
            { label: "Total Revenue", value: formatCurrency(totalNetSales) },
            { label: "Total Orders", value: validBills.length.toLocaleString("en-IN") },
          ] as ReportSummaryMetric[],
          chartType: "area" as const,
          chartTitle: "Hourly Sales Distribution (08:00 - 23:00)",
          chartData: rows.map((r) => ({ name: r.label, value: Math.round(r.netSales), secondary: r.bills })),
          chartSeriesLabel: "Hourly Revenue",
          columns,
          rows,
          csvHeaders: ["Hour", "Orders", "Avg Ticket", "Share %", "Revenue"],
          csvRows: rows.map((r) => [r.label, r.bills, Math.round(r.avgTicket), r.share.toFixed(1), Math.round(r.netSales)]),
        };
      }

      case "order-type": {
        const byChannel = new Map<string, { channel: string; orderType: string; bills: number; netSales: number }>();
        validBills.forEach((b) => {
          const channel = b.orderType === "Online" ? `Online (${b.source})` : b.orderType;
          const existing = byChannel.get(channel) || {
            channel,
            orderType: b.orderType,
            bills: 0,
            netSales: 0,
          };
          existing.bills += 1;
          existing.netSales += b.total;
          byChannel.set(channel, existing);
        });
        const rows = Array.from(byChannel.values())
          .map((r) => ({
            ...r,
            avgTicket: r.bills > 0 ? r.netSales / r.bills : 0,
            share: totalNetSales > 0 ? (r.netSales / totalNetSales) * 100 : 0,
          }))
          .sort((a, b) => b.netSales - a.netSales);

        const dineInRev = rows.filter((r) => r.orderType === "Dine-in").reduce((s, r) => s + r.netSales, 0);
        const onlineRev = rows.filter((r) => r.orderType === "Online").reduce((s, r) => s + r.netSales, 0);
        const takeawayRev = rows.filter((r) => r.orderType === "Takeaway").reduce((s, r) => s + r.netSales, 0);

        const columns: ColumnDef<(typeof rows)[0], unknown>[] = [
          { accessorKey: "channel", header: "Order Channel", cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.channel}</span> },
          { accessorKey: "orderType", header: "Type", cell: ({ row }) => <Badge variant="outline">{row.original.orderType}</Badge> },
          { accessorKey: "bills", header: "Orders", cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.bills}</span> },
          { accessorKey: "avgTicket", header: "Avg Ticket", cell: ({ row }) => <span className="font-mono tabular-nums">{formatCurrency(row.original.avgTicket)}</span> },
          { accessorKey: "share", header: "Revenue Share", cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.share.toFixed(1)}%</span> },
          { accessorKey: "netSales", header: "Net Revenue", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-slate-900">{formatCurrency(row.original.netSales)}</span> },
        ];

        return {
          metrics: [
            { label: "Dine-in Revenue", value: formatCurrency(dineInRev), hint: totalNetSales ? `${((dineInRev / totalNetSales) * 100).toFixed(1)}% share` : "" },
            { label: "Online Aggregators", value: formatCurrency(onlineRev), hint: totalNetSales ? `${((onlineRev / totalNetSales) * 100).toFixed(1)}% share` : "" },
            { label: "Takeaway Revenue", value: formatCurrency(takeawayRev), hint: totalNetSales ? `${((takeawayRev / totalNetSales) * 100).toFixed(1)}% share` : "" },
            { label: "Total Orders", value: validBills.length.toLocaleString("en-IN") },
          ] as ReportSummaryMetric[],
          chartType: "pie" as const,
          chartTitle: "Revenue Share by Order Channel",
          chartData: rows.map((r) => ({ name: r.channel, value: Math.round(r.netSales) })),
          chartSeriesLabel: "Channel Revenue",
          columns,
          rows,
          csvHeaders: ["Channel", "Type", "Orders", "Avg Ticket", "Share %", "Net Revenue"],
          csvRows: rows.map((r) => [r.channel, r.orderType, r.bills, Math.round(r.avgTicket), r.share.toFixed(1), Math.round(r.netSales)]),
        };
      }

      case "top-items":
      case "slow-items": {
        const byItem = new Map<string, { name: string; category: string; qty: number; revenue: number }>();
        ITEMS.forEach((item) => {
          byItem.set(item.name, { name: item.name, category: item.category, qty: 0, revenue: 0 });
        });
        validBills.forEach((b) => {
          b.items.forEach((bi) => {
            const entry = byItem.get(bi.name) || { name: bi.name, category: bi.category, qty: 0, revenue: 0 };
            entry.qty += bi.qty;
            entry.revenue += bi.lineTotal;
            byItem.set(bi.name, entry);
          });
        });

        const totalItemRevenue = Array.from(byItem.values()).reduce((s, i) => s + i.revenue, 0);
        const sorted = Array.from(byItem.values())
          .map((i) => ({
            ...i,
            avgPrice: i.qty > 0 ? i.revenue / i.qty : 0,
            share: totalItemRevenue > 0 ? (i.revenue / totalItemRevenue) * 100 : 0,
          }))
          .sort((a, b) =>
            report.id === "top-items" ? b.revenue - a.revenue : a.qty - b.qty || a.revenue - b.revenue
          );

        const displayRows = report.id === "top-items" ? sorted.slice(0, 15) : sorted.slice(0, 15);
        const totalUnits = sorted.reduce((s, i) => s + i.qty, 0);

        const columns: ColumnDef<(typeof displayRows)[0], unknown>[] = [
          { accessorKey: "name", header: "Menu Item", cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.name}</span> },
          { accessorKey: "category", header: "Category", cell: ({ row }) => <Badge variant="outline" className="text-xs">{row.original.category}</Badge> },
          { accessorKey: "qty", header: "Units Sold", cell: ({ row }) => <span className="font-mono tabular-nums font-medium">{row.original.qty.toLocaleString("en-IN")}</span> },
          { accessorKey: "avgPrice", header: "Avg Price", cell: ({ row }) => <span className="font-mono tabular-nums">{formatCurrency(row.original.avgPrice)}</span> },
          { accessorKey: "share", header: "Share %", cell: ({ row }) => <span className="font-mono tabular-nums text-slate-600">{row.original.share.toFixed(1)}%</span> },
          { accessorKey: "revenue", header: "Item Revenue", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-slate-900">{formatCurrency(row.original.revenue)}</span> },
        ];

        return {
          metrics: [
            {
              label: report.id === "top-items" ? "#1 Revenue Item" : "Lowest Velocity Item",
              value: displayRows[0]?.name.slice(0, 22) || "N/A",
              hint: displayRows[0] ? `${displayRows[0].qty} units · ${formatCurrency(displayRows[0].revenue)}` : "",
            },
            { label: "Total Units Sold", value: totalUnits.toLocaleString("en-IN"), hint: `${ITEMS.length} menu SKUs` },
            { label: "Item Revenue", value: formatCurrency(totalItemRevenue), hint: timeframeLabel },
            { label: "Active SKUs", value: String(sorted.filter((i) => i.qty > 0).length) },
          ] as ReportSummaryMetric[],
          chartType: "bar" as const,
          chartTitle: report.id === "top-items" ? "Top 10 Items by Revenue" : "Lowest Demand Items (Units Sold)",
          chartData: displayRows.slice(0, 10).map((r) => ({
            name: r.name.length > 18 ? `${r.name.slice(0, 16)}…` : r.name,
            value: report.id === "top-items" ? Math.round(r.revenue) : r.qty,
          })),
          chartSeriesLabel: report.id === "top-items" ? "Revenue" : "Units Sold",
          columns,
          rows: displayRows,
          csvHeaders: ["Menu Item", "Category", "Units Sold", "Avg Price", "Share %", "Revenue"],
          csvRows: displayRows.map((r) => [r.name, r.category, r.qty, Math.round(r.avgPrice), r.share.toFixed(1), Math.round(r.revenue)]),
        };
      }

      case "cat-sales": {
        const byCat = new Map<string, { category: string; units: number; revenue: number }>();
        validBills.forEach((b) => {
          b.items.forEach((bi) => {
            const entry = byCat.get(bi.category) || { category: bi.category, units: 0, revenue: 0 };
            entry.units += bi.qty;
            entry.revenue += bi.lineTotal;
            byCat.set(bi.category, entry);
          });
        });
        const totalCatRev = Array.from(byCat.values()).reduce((s, c) => s + c.revenue, 0);
        const rows = Array.from(byCat.values())
          .map((c) => ({
            ...c,
            share: totalCatRev > 0 ? (c.revenue / totalCatRev) * 100 : 0,
            avgPerUnit: c.units > 0 ? c.revenue / c.units : 0,
          }))
          .sort((a, b) => b.revenue - a.revenue);

        const columns: ColumnDef<(typeof rows)[0], unknown>[] = [
          { accessorKey: "category", header: "Category", cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.category}</span> },
          { accessorKey: "units", header: "Units Sold", cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.units.toLocaleString("en-IN")}</span> },
          { accessorKey: "avgPerUnit", header: "Avg Unit Price", cell: ({ row }) => <span className="font-mono tabular-nums">{formatCurrency(row.original.avgPerUnit)}</span> },
          { accessorKey: "share", header: "Share %", cell: ({ row }) => <span className="font-mono tabular-nums text-slate-600">{row.original.share.toFixed(1)}%</span> },
          { accessorKey: "revenue", header: "Category Revenue", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-slate-900">{formatCurrency(row.original.revenue)}</span> },
        ];

        return {
          metrics: [
            { label: "Leading Category", value: rows[0]?.category || "N/A", hint: rows[0] ? `${rows[0].share.toFixed(1)}% of menu sales` : "" },
            { label: "Menu Categories", value: String(rows.length) },
            { label: "Total Category Revenue", value: formatCurrency(totalCatRev) },
            { label: "Total Items Sold", value: rows.reduce((s, r) => s + r.units, 0).toLocaleString("en-IN") },
          ] as ReportSummaryMetric[],
          chartType: "pie" as const,
          chartTitle: "Revenue Breakdown by Menu Category",
          chartData: rows.map((r) => ({ name: r.category, value: Math.round(r.revenue) })),
          chartSeriesLabel: "Category Revenue",
          columns,
          rows,
          csvHeaders: ["Category", "Units Sold", "Avg Unit Price", "Share %", "Revenue"],
          csvRows: rows.map((r) => [r.category, r.units, Math.round(r.avgPerUnit), r.share.toFixed(1), Math.round(r.revenue)]),
        };
      }

      case "pm-split": {
        const byMode = new Map<string, { mode: string; count: number; amount: number }>();
        validBills.forEach((b) => {
          b.payments.forEach((p) => {
            const entry = byMode.get(p.mode) || { mode: p.mode, count: 0, amount: 0 };
            entry.count += 1;
            entry.amount += p.amount;
            byMode.set(p.mode, entry);
          });
        });
        const totalPaid = Array.from(byMode.values()).reduce((s, m) => s + m.amount, 0);
        const rows = Array.from(byMode.values())
          .map((m) => ({
            ...m,
            share: totalPaid > 0 ? (m.amount / totalPaid) * 100 : 0,
            avgTxn: m.count > 0 ? m.amount / m.count : 0,
          }))
          .sort((a, b) => b.amount - a.amount);

        const columns: ColumnDef<(typeof rows)[0], unknown>[] = [
          { accessorKey: "mode", header: "Payment Mode", cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.mode}</span> },
          { accessorKey: "count", header: "Transactions", cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.count.toLocaleString("en-IN")}</span> },
          { accessorKey: "avgTxn", header: "Avg Txn", cell: ({ row }) => <span className="font-mono tabular-nums">{formatCurrency(row.original.avgTxn)}</span> },
          { accessorKey: "share", header: "Share %", cell: ({ row }) => <span className="font-mono tabular-nums text-slate-600">{row.original.share.toFixed(1)}%</span> },
          { accessorKey: "amount", header: "Collected Amount", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-slate-900">{formatCurrency(row.original.amount)}</span> },
        ];

        const digitalShare = rows
          .filter((r) => r.mode !== "Cash")
          .reduce((s, r) => s + r.share, 0);

        return {
          metrics: [
            { label: "Top Payment Mode", value: rows[0]?.mode || "N/A", hint: rows[0] ? `${rows[0].share.toFixed(1)}% share` : "" },
            { label: "Digital Payments", value: `${digitalShare.toFixed(1)}%`, hint: "UPI + Card + Wallet" },
            { label: "Total Collected", value: formatCurrency(totalPaid) },
            { label: "Transactions", value: validBills.length.toLocaleString("en-IN") },
          ] as ReportSummaryMetric[],
          chartType: "pie" as const,
          chartTitle: "Payment Mode Collection Split",
          chartData: rows.map((r) => ({ name: r.mode, value: Math.round(r.amount) })),
          chartSeriesLabel: "Collected Amount",
          columns,
          rows,
          csvHeaders: ["Payment Mode", "Transactions", "Avg Txn", "Share %", "Amount"],
          csvRows: rows.map((r) => [r.mode, r.count, Math.round(r.avgTxn), r.share.toFixed(1), Math.round(r.amount)]),
        };
      }

      case "tax-summary": {
        const byDay = new Map<string, { dateKey: string; bills: number; taxable: number; cgst: number; sgst: number; totalTax: number }>();
        validBills.forEach((b) => {
          const dateKey = format(new Date(b.createdAt), "yyyy-MM-dd");
          const entry = byDay.get(dateKey) || { dateKey, bills: 0, taxable: 0, cgst: 0, sgst: 0, totalTax: 0 };
          entry.bills += 1;
          entry.taxable += b.subtotal - b.discount;
          entry.cgst += b.tax / 2;
          entry.sgst += b.tax / 2;
          entry.totalTax += b.tax;
          byDay.set(dateKey, entry);
        });
        const rows = Array.from(byDay.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));

        const columns: ColumnDef<(typeof rows)[0], unknown>[] = [
          { accessorKey: "dateKey", header: "Tax Date", cell: ({ row }) => <span className="font-mono font-medium text-slate-900">{row.original.dateKey}</span> },
          { accessorKey: "bills", header: "Invoices", cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.bills}</span> },
          { accessorKey: "taxable", header: "Taxable Value", cell: ({ row }) => <span className="font-mono tabular-nums">{formatCurrency(row.original.taxable)}</span> },
          { accessorKey: "cgst", header: "CGST (2.5%)", cell: ({ row }) => <span className="font-mono tabular-nums text-slate-600">{formatCurrency(row.original.cgst)}</span> },
          { accessorKey: "sgst", header: "SGST (2.5%)", cell: ({ row }) => <span className="font-mono tabular-nums text-slate-600">{formatCurrency(row.original.sgst)}</span> },
          { accessorKey: "totalTax", header: "Total GST (5%)", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-slate-900">{formatCurrency(row.original.totalTax)}</span> },
        ];

        return {
          metrics: [
            { label: "Total GST Collected", value: formatCurrency(totalTax), hint: "5% Restaurant GST" },
            { label: "CGST (2.5%)", value: formatCurrency(totalTax / 2) },
            { label: "SGST (2.5%)", value: formatCurrency(totalTax / 2) },
            { label: "Taxable Turnover", value: formatCurrency(totalSubtotal - totalDiscount) },
          ] as ReportSummaryMetric[],
          chartType: "bar" as const,
          chartTitle: "Daily GST Collection (CGST + SGST)",
          chartData: rows.map((r) => ({ name: format(new Date(r.dateKey), "dd MMM"), value: Math.round(r.totalTax) })),
          chartSeriesLabel: "Total GST",
          columns,
          rows: [...rows].reverse(),
          csvHeaders: ["Date", "Invoices", "Taxable Value", "CGST (2.5%)", "SGST (2.5%)", "Total GST"],
          csvRows: rows.map((r) => [r.dateKey, r.bills, Math.round(r.taxable), Math.round(r.cgst), Math.round(r.sgst), Math.round(r.totalTax)]),
        };
      }

      case "discounts": {
        const discountedBills = validBills.filter((b) => b.discount > 0);
        const byOutlet = new Map<string, { outletName: string; discountedCount: number; totalBills: number; discountSum: number; revenueSum: number }>();
        discountedBills.forEach((b) => {
          const outletName = outletMap.get(b.outletId)?.name || b.outletId;
          const entry = byOutlet.get(b.outletId) || { outletName, discountedCount: 0, totalBills: 0, discountSum: 0, revenueSum: 0 };
          entry.discountedCount += 1;
          entry.discountSum += b.discount;
          entry.revenueSum += b.total;
          byOutlet.set(b.outletId, entry);
        });
        validBills.forEach((b) => {
          const entry = byOutlet.get(b.outletId);
          if (entry) entry.totalBills += 1;
        });

        const rows = Array.from(byOutlet.values())
          .map((r) => ({
            ...r,
            discountRate: r.revenueSum > 0 ? (r.discountSum / (r.revenueSum + r.discountSum)) * 100 : 0,
          }))
          .sort((a, b) => b.discountSum - a.discountSum);

        const columns: ColumnDef<(typeof rows)[0], unknown>[] = [
          { accessorKey: "outletName", header: "Outlet", cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.outletName}</span> },
          { accessorKey: "discountedCount", header: "Discounted Bills", cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.discountedCount}</span> },
          { accessorKey: "totalBills", header: "Total Bills", cell: ({ row }) => <span className="font-mono tabular-nums text-slate-500">{row.original.totalBills}</span> },
          { accessorKey: "discountRate", header: "Effective Disc %", cell: ({ row }) => <span className="font-mono tabular-nums text-amber-700">{row.original.discountRate.toFixed(1)}%</span> },
          { accessorKey: "discountSum", header: "Total Discount", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-rose-600">{formatCurrency(row.original.discountSum)}</span> },
        ];

        return {
          metrics: [
            { label: "Total Discounts Given", value: formatCurrency(totalDiscount), hint: timeframeLabel },
            { label: "Discounted Bills", value: discountedBills.length.toLocaleString("en-IN"), hint: `${validBills.length ? ((discountedBills.length / validBills.length) * 100).toFixed(1) : 0}% of orders` },
            { label: "Avg Discount / Order", value: formatCurrency(discountedBills.length ? totalDiscount / discountedBills.length : 0) },
            { label: "Discount % of Gross", value: `${totalSubtotal > 0 ? ((totalDiscount / totalSubtotal) * 100).toFixed(2) : 0}%` },
          ] as ReportSummaryMetric[],
          chartType: "bar" as const,
          chartTitle: "Discount Value by Outlet (Top 10)",
          chartData: rows.slice(0, 10).map((r) => ({
            name: r.outletName.replace("Tinku's Cafe - ", "Tinku's "),
            value: Math.round(r.discountSum),
          })),
          chartSeriesLabel: "Discount Given",
          columns,
          rows,
          csvHeaders: ["Outlet", "Discounted Bills", "Total Bills", "Effective Disc %", "Total Discount"],
          csvRows: rows.map((r) => [r.outletName, r.discountedCount, r.totalBills, r.discountRate.toFixed(1), Math.round(r.discountSum)]),
        };
      }

      case "staff-perf": {
        const byStaff = new Map<
          string,
          { staffId: string; name: string; role: string; outletName: string; bills: number; cancellations: number; revenue: number }
        >();
        STAFF.filter((s) => (selectedOutletId === "all" || s.outletId === selectedOutletId) && s.department !== "Kitchen").forEach((s) => {
          byStaff.set(s.id, {
            staffId: s.id,
            name: s.name,
            role: s.role,
            outletName: outletMap.get(s.outletId)?.name || s.outletId,
            bills: 0,
            cancellations: 0,
            revenue: 0,
          });
        });

        reportBills.forEach((b) => {
          const entry = byStaff.get(b.staffId);
          if (entry) {
            if (b.status === "Cancelled") {
              entry.cancellations += 1;
            } else {
              entry.bills += 1;
              entry.revenue += b.total;
            }
          }
        });

        const rows = Array.from(byStaff.values())
          .filter((r) => r.bills > 0 || r.cancellations > 0)
          .sort((a, b) => b.revenue - a.revenue);

        const columns: ColumnDef<(typeof rows)[0], unknown>[] = [
          { accessorKey: "name", header: "Staff Member", cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.name}</span> },
          { accessorKey: "role", header: "Role", cell: ({ row }) => <Badge variant="outline" className="text-xs">{row.original.role}</Badge> },
          { accessorKey: "outletName", header: "Outlet", cell: ({ row }) => <span className="text-xs text-slate-600">{row.original.outletName}</span> },
          { accessorKey: "bills", header: "Bills Handled", cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.bills}</span> },
          { accessorKey: "cancellations", header: "Cancelled", cell: ({ row }) => <span className="font-mono tabular-nums text-rose-600">{row.original.cancellations}</span> },
          { accessorKey: "revenue", header: "Sales Generated", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-slate-900">{formatCurrency(row.original.revenue)}</span> },
        ];

        return {
          metrics: [
            { label: "Top Staff Performer", value: rows[0]?.name.slice(0, 22) || "N/A", hint: rows[0] ? formatCurrency(rows[0].revenue) : "" },
            { label: "Active Billing Staff", value: String(rows.length) },
            { label: "Total Sales Handled", value: formatCurrency(rows.reduce((s, r) => s + r.revenue, 0)) },
            { label: "Avg Sales / Staff", value: formatCurrency(rows.length ? rows.reduce((s, r) => s + r.revenue, 0) / rows.length : 0) },
          ] as ReportSummaryMetric[],
          chartType: "bar" as const,
          chartTitle: "Top 10 Staff by Sales Handled",
          chartData: rows.slice(0, 10).map((r) => ({
            name: r.name.length > 18 ? `${r.name.slice(0, 16)}…` : r.name,
            value: Math.round(r.revenue),
          })),
          chartSeriesLabel: "Sales Handled",
          columns,
          rows,
          csvHeaders: ["Staff Member", "Role", "Outlet", "Bills Handled", "Cancelled", "Sales Generated"],
          csvRows: rows.map((r) => [r.name, r.role, r.outletName, r.bills, r.cancellations, Math.round(r.revenue)]),
        };
      }

      case "cust-loyalty": {
        const segmentMap = new Map<string, { segment: string; customers: number; lifetimeSpend: number }>();
        CUSTOMERS.forEach((c) => {
          const entry = segmentMap.get(c.segment) || { segment: c.segment, customers: 0, lifetimeSpend: 0 };
          entry.customers += 1;
          entry.lifetimeSpend += c.lifetimeSpend;
          segmentMap.set(c.segment, entry);
        });
        const segChart = Array.from(segmentMap.values());
        const rows = [...CUSTOMERS].sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);
        const totalLtv = CUSTOMERS.reduce((s, c) => s + c.lifetimeSpend, 0);

        const columns: ColumnDef<(typeof rows)[0], unknown>[] = [
          { accessorKey: "name", header: "Customer", cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.name}</span> },
          { accessorKey: "phone", header: "Phone", cell: ({ row }) => <span className="font-mono text-slate-600">{row.original.phone}</span> },
          {
            accessorKey: "segment",
            header: "Segment",
            cell: ({ row }) => (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  row.original.segment === "VIP" && "bg-amber-50 text-amber-800 border-amber-200",
                  row.original.segment === "Repeat" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                  row.original.segment === "Lapsed" && "bg-rose-50 text-rose-700 border-rose-200"
                )}
              >
                {row.original.segment}
              </Badge>
            ),
          },
          { accessorKey: "visits", header: "Visits", cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.visits}</span> },
          { accessorKey: "lifetimeSpend", header: "Lifetime Spend", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-slate-900">{formatCurrency(row.original.lifetimeSpend)}</span> },
        ];

        return {
          metrics: [
            { label: "Total CRM Customers", value: String(CUSTOMERS.length) },
            { label: "VIP + Repeat Share", value: `${(((CUSTOMERS.filter((c) => c.segment === "VIP" || c.segment === "Repeat").length) / CUSTOMERS.length) * 100).toFixed(0)}%` },
            { label: "Combined Lifetime Value", value: formatCurrency(totalLtv) },
            { label: "Avg Visits / Guest", value: (CUSTOMERS.reduce((s, c) => s + c.visits, 0) / CUSTOMERS.length).toFixed(1) },
          ] as ReportSummaryMetric[],
          chartType: "pie" as const,
          chartTitle: "Lifetime Spend by Customer Segment",
          chartData: segChart.map((s) => ({ name: `${s.segment} (${s.customers})`, value: Math.round(s.lifetimeSpend) })),
          chartSeriesLabel: "Lifetime Spend",
          columns,
          rows,
          csvHeaders: ["Customer", "Phone", "Segment", "Visits", "Lifetime Spend"],
          csvRows: rows.map((r) => [r.name, r.phone, r.segment, r.visits, Math.round(r.lifetimeSpend)]),
        };
      }

      case "low-stock": {
        const scoped = stockItems.filter(
          (item) => selectedOutletId === "all" || item.outletId === selectedOutletId
        );
        const lowRows = scoped
          .filter((item) => item.onHand < item.reorderLevel)
          .map((item) => ({
            ...item,
            outletName: outletMap.get(item.outletId)?.name || item.outletId,
            deficit: Math.max(0, item.reorderLevel - item.onHand),
            severity: item.onHand <= Math.max(1, Math.floor(item.reorderLevel / 2)) ? "Critical Low" : "Below Reorder",
          }))
          .sort((a, b) => b.deficit - a.deficit);

        const byOutletCounts = new Map<string, number>();
        lowRows.forEach((r) => {
          const shortName = r.outletName.replace("Tinku's Cafe - ", "Tinku's ");
          byOutletCounts.set(shortName, (byOutletCounts.get(shortName) || 0) + 1);
        });

        const columns: ColumnDef<(typeof lowRows)[0], unknown>[] = [
          { accessorKey: "name", header: "Ingredient / Item", cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.name}</span> },
          { accessorKey: "outletName", header: "Outlet", cell: ({ row }) => <span className="text-xs text-slate-700">{row.original.outletName}</span> },
          {
            accessorKey: "severity",
            header: "Severity",
            cell: ({ row }) => (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs gap-1",
                  row.original.severity === "Critical Low"
                    ? "bg-rose-100 text-rose-800 border-rose-300"
                    : "bg-amber-100 text-amber-900 border-amber-300"
                )}
              >
                <AlertTriangle className="w-3 h-3" />
                {row.original.severity}
              </Badge>
            ),
          },
          { accessorKey: "onHand", header: "On Hand", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-rose-700">{row.original.onHand} {row.original.unit}</span> },
          { accessorKey: "reorderLevel", header: "Reorder Point", cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.reorderLevel} {row.original.unit}</span> },
          { accessorKey: "deficit", header: "Shortfall", cell: ({ row }) => <span className="font-mono tabular-nums font-semibold text-amber-800">{row.original.deficit} {row.original.unit}</span> },
        ];

        return {
          metrics: [
            { label: "Items Below Reorder", value: String(lowRows.length), hint: `Out of ${scoped.length} tracked entries` },
            { label: "Critical Low Items", value: String(lowRows.filter((r) => r.severity === "Critical Low").length) },
            { label: "Total Shortfall", value: `${lowRows.reduce((s, r) => s + r.deficit, 0)} kg` },
            { label: "Outlets Impacted", value: String(byOutletCounts.size) },
          ] as ReportSummaryMetric[],
          chartType: "bar" as const,
          chartTitle: "Low-Stock Alerts by Outlet (Top 10)",
          chartData: Array.from(byOutletCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, value]) => ({ name, value })),
          chartSeriesLabel: "Flagged SKUs",
          columns,
          rows: lowRows,
          csvHeaders: ["Item", "Outlet", "Severity", "On Hand", "Reorder Point", "Shortfall"],
          csvRows: lowRows.map((r) => [r.name, r.outletName, r.severity, `${r.onHand} ${r.unit}`, `${r.reorderLevel} ${r.unit}`, `${r.deficit} ${r.unit}`]),
        };
      }

      case "stock-transfers": {
        const scopedTransfers = stockTransfers.filter((t) => {
          const matchesOutlet =
            selectedOutletId === "all" ||
            t.fromOutletId === selectedOutletId ||
            t.toOutletId === selectedOutletId;
          if (!matchesOutlet) return false;
          return isWithinInterval(new Date(t.transferredAt), {
            start: dateRange.from,
            end: dateRange.to,
          });
        });
        const byItem = new Map<string, number>();
        scopedTransfers.forEach((t) => {
          byItem.set(t.itemName, (byItem.get(t.itemName) || 0) + t.quantity);
        });

        const columns: ColumnDef<StockTransfer, unknown>[] = [
          { accessorKey: "itemName", header: "Item", cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.itemName}</span> },
          { accessorKey: "quantity", header: "Qty", cell: ({ row }) => <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200 font-mono">{row.original.quantity} {row.original.unit}</Badge> },
          {
            accessorKey: "fromOutletName",
            header: "Source (Before → After)",
            cell: ({ row }) => (
              <div className="text-xs">
                <p className="font-medium text-slate-800">{row.original.fromOutletName}</p>
                <span className="font-mono text-rose-700 inline-flex items-center gap-1">
                  {row.original.sourceBefore} <ArrowRight className="w-3 h-3" /> {row.original.sourceAfter} {row.original.unit}
                </span>
              </div>
            ),
          },
          {
            accessorKey: "toOutletName",
            header: "Destination (Before → After)",
            cell: ({ row }) => (
              <div className="text-xs">
                <p className="font-medium text-slate-800">{row.original.toOutletName}</p>
                <span className="font-mono text-emerald-700 inline-flex items-center gap-1">
                  {row.original.destBefore} <ArrowRight className="w-3 h-3" /> {row.original.destAfter} {row.original.unit}
                </span>
              </div>
            ),
          },
          {
            accessorKey: "transferredAt",
            header: "Timestamp",
            cell: ({ row }) => <span className="text-xs text-slate-600">{format(new Date(row.original.transferredAt), "dd MMM, HH:mm")}</span>,
          },
        ];

        return {
          metrics: [
            { label: "Total Transfers", value: String(scopedTransfers.length), hint: activeOutletLabel },
            { label: "Total Qty Moved", value: `${scopedTransfers.reduce((s, t) => s + t.quantity, 0)} kg` },
            { label: "Unique Items Moved", value: String(byItem.size) },
            { label: "Latest Transfer", value: scopedTransfers[0] ? format(new Date(scopedTransfers[0].transferredAt), "HH:mm") : "N/A" },
          ] as ReportSummaryMetric[],
          chartType: "bar" as const,
          chartTitle: "Transferred Quantity by Ingredient",
          chartData: Array.from(byItem.entries()).map(([name, value]) => ({
            name: name.length > 20 ? `${name.slice(0, 18)}…` : name,
            value,
          })),
          chartSeriesLabel: "Quantity Moved (kg)",
          columns,
          rows: scopedTransfers,
          csvHeaders: ["Item", "Quantity", "Source Outlet", "Source Before", "Source After", "Destination Outlet", "Dest Before", "Dest After", "Timestamp"],
          csvRows: scopedTransfers.map((t) => [
            t.itemName,
            `${t.quantity} ${t.unit}`,
            t.fromOutletName,
            t.sourceBefore,
            t.sourceAfter,
            t.toOutletName,
            t.destBefore,
            t.destAfter,
            t.transferredAt,
          ]),
        };
      }
    }
  }, [report.id, validBills, reportBills, dateRange, outlets, selectedOutletId, stockItems, stockTransfers, outletMap, timeframeLabel, activeOutletLabel]);

  const handleExportCsv = () => {
    const slug = `${report.id}-${timeframe}-${format(new Date(), "yyyyMMdd")}.csv`;
    downloadCsv(slug, builtReport.csvHeaders, builtReport.csvRows);
    toast.success(`Exported ${report.name} (${builtReport.csvRows.length} rows).`);
  };

  return (
    <div className="space-y-6">
      {/* Top Report Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="gap-1.5 shrink-0 mt-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            All Reports
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {report.name}
              </h2>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                {report.group}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {report.desc} · Scope: <span className="font-medium text-slate-700">{activeOutletLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Switch active report"
            value={report.id}
            onChange={(e) => onSelectReport(e.target.value as ReportId)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-orange-400"
          >
            {allReports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.group}: {r.name}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {(
              [
                { id: "today", label: "Today" },
                { id: "7d", label: "7D" },
                { id: "30d", label: "30D" },
                { id: "90d", label: "90D" },
              ] as Array<{ id: ReportTimeframe; label: string }>
            ).map((tf) => (
              <Button
                key={tf.id}
                type="button"
                variant={timeframe === tf.id ? "default" : "ghost"}
                size="sm"
                onClick={() => onTimeframeChange(tf.id)}
                className={cn(
                  "h-7 px-2.5 text-xs",
                  timeframe === tf.id
                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                    : "text-slate-600"
                )}
              >
                {tf.label}
              </Button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5 h-9"
          >
            <Download className="w-4 h-4 text-orange-600" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {builtReport.metrics.map((m) => (
          <Card key={m.label} className="border-slate-200">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {m.label}
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5 truncate">
                {m.value}
              </p>
              {m.hint && <p className="text-xs text-slate-400 mt-1 truncate">{m.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Visualization Card */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                {builtReport.chartTitle}
              </CardTitle>
              <CardDescription>
                {timeframeLabel} · {activeOutletLabel}
              </CardDescription>
            </div>
            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
          </div>
        </CardHeader>
        <CardContent>
          {builtReport.chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">
              No chart data available for the selected outlet and timeframe.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {builtReport.chartType === "area" ? (
                  <AreaChart data={builtReport.chartData} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="reportAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, borderColor: "#e2e8f0", fontSize: 12 }}
                      formatter={(val) => {
                        const num = Number(val ?? 0);
                        return [
                          report.id === "low-stock" || report.id === "stock-transfers"
                            ? num
                            : formatCurrency(num),
                          builtReport.chartSeriesLabel,
                        ];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      fill="url(#reportAreaFill)"
                    />
                  </AreaChart>
                ) : builtReport.chartType === "pie" ? (
                  <PieChart>
                    <Pie
                      data={builtReport.chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={105}
                      paddingAngle={3}
                    >
                      {builtReport.chartData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 10, borderColor: "#e2e8f0", fontSize: 12 }}
                      formatter={(val) => [
                        formatCurrency(Number(val ?? 0)),
                        builtReport.chartSeriesLabel,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                ) : (
                  <BarChart data={builtReport.chartData} margin={{ top: 10, right: 16, left: 8, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      interval={0}
                      angle={builtReport.chartData.length > 6 ? -18 : 0}
                      textAnchor={builtReport.chartData.length > 6 ? "end" : "middle"}
                      height={builtReport.chartData.length > 6 ? 54 : 30}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, borderColor: "#e2e8f0", fontSize: 12 }}
                      formatter={(val) => {
                        const num = Number(val ?? 0);
                        return [
                          report.id === "slow-items" || report.id === "low-stock" || report.id === "stock-transfers"
                            ? num
                            : formatCurrency(num),
                          builtReport.chartSeriesLabel,
                        ];
                      }}
                    />
                    <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Breakdown Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Detailed Breakdown</CardTitle>
          <CardDescription>
            {builtReport.rows.length} record{builtReport.rows.length === 1 ? "" : "s"} in{" "}
            {report.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={builtReport.columns as ColumnDef<unknown, unknown>[]}
            data={builtReport.rows as unknown[]}
            searchPlaceholder={`Search ${report.name.toLowerCase()}...`}
          />
        </CardContent>
      </Card>
    </div>
  );
};
