/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  eachDayOfInterval,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  subDays,
} from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Bill, Outlet } from '@/types';
import { getBills } from '@/lib/mock-data';

export interface DashboardExportPayload {
  outletScopeLabel: string;
  dateRangeLabel: string;
  selectedOutletId: string | 'all';
  dateRange: { from: Date; to: Date };
  stats: {
    grossSales: number;
    billsCount: number;
    avgBillValue: number;
    covers: number;
    avgSpendPerGuest: number;
    momGrowth: number;
  };
  bills: Bill[];
  outlets: Outlet[];
  paymentData: Array<{ name: string; value: number }>;
  topItems: Array<{ name: string; qty: number; revenue: number }>;
  outletSalesBreakdown: Array<{
    outlet: Outlet;
    revenue: number;
    ordersCount: number;
    avgBill: number;
    cancelledCount: number;
    lastOrderAt: string;
  }>;
}

interface WeeklyRow {
  dayLabel: string;
  currentDate: string;
  prevDate: string;
  currentRev: number;
  prevRev: number;
  currentOrders: number;
  prevOrders: number;
  pctChange: number;
}

function formatInrPlain(amount: number): string {
  return `INR ${Math.round(amount).toLocaleString('en-IN')}`;
}

function buildWeeklyComparison(
  dateRange: { from: Date; to: Date },
  selectedOutletId: string | 'all'
): {
  rows: WeeklyRow[];
  totalCurrentRev: number;
  totalPrevRev: number;
  wowPct: number;
} {
  const now = new Date();
  const effectiveEnd = dateRange.to > now ? now : dateRange.to;
  const currentStart = startOfDay(subDays(effectiveEnd, 6));
  const currentEnd = endOfDay(effectiveEnd);
  const prevStart = startOfDay(subDays(currentStart, 7));
  const prevEnd = endOfDay(subDays(currentStart, 1));

  const outletFilter = selectedOutletId === 'all' ? undefined : selectedOutletId;
  const currentBills = getBills(currentStart, currentEnd, outletFilter);
  const prevBills = getBills(prevStart, prevEnd, outletFilter);
  const days = eachDayOfInterval({ start: currentStart, end: effectiveEnd });

  let totalCurrentRev = 0;
  let totalPrevRev = 0;

  const rows: WeeklyRow[] = days.map((day) => {
    const prevDay = subDays(day, 7);
    const currValid = currentBills.filter(
      (b) => b.status !== 'Cancelled' && isSameDay(new Date(b.createdAt), day)
    );
    const prevValid = prevBills.filter(
      (b) => b.status !== 'Cancelled' && isSameDay(new Date(b.createdAt), prevDay)
    );

    const currentRev = currValid.reduce((sum, b) => sum + b.total, 0);
    const prevRev = prevValid.reduce((sum, b) => sum + b.total, 0);
    totalCurrentRev += currentRev;
    totalPrevRev += prevRev;

    const pctChange =
      prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : currentRev > 0 ? 100 : 0;

    return {
      dayLabel: format(day, 'EEE'),
      currentDate: format(day, 'dd MMM'),
      prevDate: format(prevDay, 'dd MMM'),
      currentRev: Math.round(currentRev),
      prevRev: Math.round(prevRev),
      currentOrders: currValid.length,
      prevOrders: prevValid.length,
      pctChange,
    };
  });

  const wowPct =
    totalPrevRev > 0
      ? ((totalCurrentRev - totalPrevRev) / totalPrevRev) * 100
      : totalCurrentRev > 0
        ? 100
        : 0;

  return { rows, totalCurrentRev, totalPrevRev, wowPct };
}

function buildChannelBreakdown(bills: Bill[]) {
  const channels = new Map<string, { orders: number; revenue: number }>();
  bills.forEach((b) => {
    if (b.status === 'Cancelled') return;
    const key = b.source || b.orderType;
    const prev = channels.get(key) || { orders: 0, revenue: 0 };
    prev.orders += 1;
    prev.revenue += b.total;
    channels.set(key, prev);
  });
  return Array.from(channels.entries())
    .map(([source, data]) => ({
      source,
      orders: data.orders,
      revenue: Math.round(data.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function sanitizeFileSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportDashboardCsv(payload: DashboardExportPayload): string {
  const escape = (val: string | number): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];
  const pushRow = (cols: Array<string | number>) => {
    lines.push(cols.map(escape).join(','));
  };

  const generatedAt = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const paidBills = payload.bills.filter((b) => b.status !== 'Cancelled');
  const cancelledBills = payload.bills.filter((b) => b.status === 'Cancelled');
  const netPaidSales = paidBills.reduce((sum, b) => sum + b.total, 0);
  const weekly = buildWeeklyComparison(payload.dateRange, payload.selectedOutletId);
  const channels = buildChannelBreakdown(payload.bills);

  // Header metadata
  pushRow(['Petpooja Dashboard Sales & Performance Export']);
  pushRow(['Outlet Scope', payload.outletScopeLabel]);
  pushRow(['Date Range', payload.dateRangeLabel]);
  pushRow(['Generated At', generatedAt]);
  pushRow([]);

  // Section 1: KPI Summary
  pushRow(['EXECUTIVE KPI SUMMARY']);
  pushRow(['Metric', 'Value']);
  pushRow(['Gross Sales (INR)', Math.round(payload.stats.grossSales)]);
  pushRow(['Net Paid Sales (INR)', Math.round(netPaidSales)]);
  pushRow(['Total Bills Count', payload.stats.billsCount]);
  pushRow(['Active / Paid Bills', paidBills.length]);
  pushRow(['Cancelled Bills', cancelledBills.length]);
  pushRow(['Average Bill Value (INR)', Math.round(payload.stats.avgBillValue)]);
  pushRow(['Total Covers', payload.stats.covers]);
  pushRow(['Avg Spend Per Guest (INR)', Math.round(payload.stats.avgSpendPerGuest)]);
  pushRow(['MoM Revenue Growth (%)', `${payload.stats.momGrowth.toFixed(1)}%`]);
  pushRow(['7-Day WoW Revenue Change (%)', `${weekly.wowPct.toFixed(1)}%`]);
  pushRow([]);

  // Section 2: Week-over-Week 7-Day Performance
  pushRow(['7-DAY WEEK-OVER-WEEK PERFORMANCE']);
  pushRow([
    'Weekday',
    'Current Date',
    'Current Revenue (INR)',
    'Current Orders',
    'Prior Date',
    'Prior Revenue (INR)',
    'Prior Orders',
    'WoW Change (%)',
  ]);
  weekly.rows.forEach((r) => {
    pushRow([
      r.dayLabel,
      r.currentDate,
      r.currentRev,
      r.currentOrders,
      r.prevDate,
      r.prevRev,
      r.prevOrders,
      `${r.pctChange >= 0 ? '+' : ''}${r.pctChange.toFixed(1)}%`,
    ]);
  });
  pushRow([]);

  // Section 3: Payment Mode Split
  pushRow(['PAYMENT MODE SPLIT']);
  pushRow(['Payment Mode', 'Amount (INR)', 'Share (%)']);
  const totalPayments = payload.paymentData.reduce((sum, p) => sum + p.value, 0);
  payload.paymentData.forEach((pm) => {
    const share = totalPayments > 0 ? (pm.value / totalPayments) * 100 : 0;
    pushRow([pm.name, Math.round(pm.value), `${share.toFixed(1)}%`]);
  });
  pushRow([]);

  // Section 4: Channel / Platform Breakdown
  pushRow(['ORDER CHANNEL PERFORMANCE']);
  pushRow(['Channel / Source', 'Orders', 'Revenue (INR)']);
  channels.forEach((ch) => {
    pushRow([ch.source, ch.orders, ch.revenue]);
  });
  pushRow([]);

  // Section 5: Top Selling Items
  pushRow(['TOP 5 ITEMS BY REVENUE']);
  pushRow(['Rank', 'Item Name', 'Units Sold', 'Revenue (INR)']);
  payload.topItems.forEach((item, idx) => {
    pushRow([idx + 1, item.name, item.qty, Math.round(item.revenue)]);
  });
  pushRow([]);

  // Section 6: Outlet Performance Breakdown
  pushRow(['OUTLET SALES BREAKDOWN']);
  pushRow(['Outlet Name', 'City', 'Revenue (INR)', 'Orders', 'Avg Bill (INR)', 'Cancelled', 'Last Order']);
  payload.outletSalesBreakdown.forEach((row) => {
    pushRow([
      row.outlet.name,
      row.outlet.city,
      Math.round(row.revenue),
      row.ordersCount,
      Math.round(row.avgBill),
      row.cancelledCount,
      row.lastOrderAt,
    ]);
  });
  pushRow([]);

  // Section 7: Recent Billing Transactions
  const recentBills = [...payload.bills]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100);
  const outletLookup = new Map(payload.outlets.map((o) => [o.id, o.name]));

  pushRow([`RECENT BILLING TRANSACTIONS (LATEST ${recentBills.length})`]);
  pushRow([
    'Bill ID',
    'Timestamp',
    'Outlet',
    'Order Type',
    'Source',
    'Payment Mode',
    'Status',
    'Subtotal (INR)',
    'Tax (INR)',
    'Discount (INR)',
    'Total (INR)',
  ]);
  recentBills.forEach((bill) => {
    pushRow([
      bill.id,
      format(new Date(bill.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      outletLookup.get(bill.outletId) || bill.outletId,
      bill.orderType,
      bill.source,
      bill.payments.map((p) => p.mode).join(' / '),
      bill.status,
      Math.round(bill.subtotal),
      Math.round(bill.tax),
      Math.round(bill.discount),
      Math.round(bill.total),
    ]);
  });

  const csvContent = `\uFEFF${lines.join('\n')}`;
  const filename = `petpooja-dashboard-${sanitizeFileSlug(payload.outletScopeLabel)}-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerFileDownload(blob, filename);
  return filename;
}

export function exportDashboardPdf(payload: DashboardExportPayload): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  const generatedAt = format(new Date(), 'dd MMM yyyy, HH:mm');
  const paidBills = payload.bills.filter((b) => b.status !== 'Cancelled');
  const cancelledCount = payload.bills.length - paidBills.length;
  const netPaidSales = paidBills.reduce((sum, b) => sum + b.total, 0);
  const weekly = buildWeeklyComparison(payload.dateRange, payload.selectedOutletId);
  const channels = buildChannelBreakdown(payload.bills);
  const outletLookup = new Map(payload.outlets.map((o) => [o.id, o.name]));

  // Top orange brand bar
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('Petpooja Sales & Performance Report', marginX, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Scope: ${payload.outletScopeLabel}  |  Period: ${payload.dateRangeLabel}  |  Exported: ${generatedAt}`,
    marginX,
    58
  );

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, 68, pageWidth - marginX, 68);

  // 1. KPI Summary Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Executive KPI Summary', marginX, 88);

  autoTable(doc, {
    startY: 96,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 5 },
    head: [['Key Metric', 'Value', 'Key Metric', 'Value']],
    body: [
      [
        'Gross Sales',
        formatInrPlain(payload.stats.grossSales),
        'Net Paid Sales',
        formatInrPlain(netPaidSales),
      ],
      [
        'Total Bills',
        `${payload.stats.billsCount} (${cancelledCount} cancelled)`,
        'Avg Bill Value',
        formatInrPlain(payload.stats.avgBillValue),
      ],
      [
        'Total Covers',
        payload.stats.covers.toLocaleString('en-IN'),
        'Avg Spend / Guest',
        formatInrPlain(payload.stats.avgSpendPerGuest),
      ],
      [
        'MoM Revenue Growth',
        `${payload.stats.momGrowth >= 0 ? '+' : ''}${payload.stats.momGrowth.toFixed(1)}%`,
        '7-Day WoW Change',
        `${weekly.wowPct >= 0 ? '+' : ''}${weekly.wowPct.toFixed(1)}%`,
      ],
    ],
  });

  const afterKpiY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 210;

  // 2. Week-over-Week 7-Day Performance Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Week-over-Week 7-Day Revenue Comparison', marginX, afterKpiY + 22);

  autoTable(doc, {
    startY: afterKpiY + 30,
    margin: { left: marginX, right: marginX },
    theme: 'striped',
    headStyles: { fillColor: [249, 115, 22], textColor: 255, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 4.5 },
    head: [['Day', 'Current Date', 'Current Rev', 'Orders', 'Prior Date', 'Prior Rev', 'WoW %']],
    body: weekly.rows.map((r) => [
      r.dayLabel,
      r.currentDate,
      formatInrPlain(r.currentRev),
      r.currentOrders,
      r.prevDate,
      formatInrPlain(r.prevRev),
      `${r.pctChange >= 0 ? '+' : ''}${r.pctChange.toFixed(1)}%`,
    ]),
  });

  const afterWowY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 420;

  // 3. Payment Mode Split & Channel Mix
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('3. Payment Modes & Order Channels', marginX, afterWowY + 22);

  const totalPm = payload.paymentData.reduce((s, p) => s + p.value, 0);
  autoTable(doc, {
    startY: afterWowY + 30,
    margin: { left: marginX, right: pageWidth / 2 + 8 },
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 4.5 },
    head: [['Payment Mode', 'Amount', 'Share']],
    body:
      payload.paymentData.length > 0
        ? payload.paymentData.map((pm) => [
            pm.name,
            formatInrPlain(pm.value),
            `${totalPm > 0 ? ((pm.value / totalPm) * 100).toFixed(1) : '0.0'}%`,
          ])
        : [['No data', '-', '-']],
  });

  const leftColFinalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? afterWowY + 120;

  autoTable(doc, {
    startY: afterWowY + 30,
    margin: { left: pageWidth / 2 + 8, right: marginX },
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 4.5 },
    head: [['Channel', 'Orders', 'Revenue']],
    body:
      channels.length > 0
        ? channels.map((ch) => [ch.source, ch.orders, formatInrPlain(ch.revenue)])
        : [['No data', '-', '-']],
  });

  const rightColFinalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? afterWowY + 120;
  const afterMixY = Math.max(leftColFinalY, rightColFinalY);

  // 4. Top 5 Items
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('4. Top 5 Selling Items', marginX, afterMixY + 22);

  autoTable(doc, {
    startY: afterMixY + 30,
    margin: { left: marginX, right: marginX },
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 4.5 },
    head: [['#', 'Item Name', 'Units Sold', 'Revenue']],
    body:
      payload.topItems.length > 0
        ? payload.topItems.map((item, idx) => [
            idx + 1,
            item.name,
            item.qty,
            formatInrPlain(item.revenue),
          ])
        : [['-', 'No items recorded in selected period', '-', '-']],
  });

  const afterTopY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? afterMixY + 130;

  // 5. Outlet Sales Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('5. Outlet Performance Breakdown', marginX, afterTopY + 22);

  autoTable(doc, {
    startY: afterTopY + 30,
    margin: { left: marginX, right: marginX },
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
    styles: { fontSize: 8, cellPadding: 4 },
    head: [['Outlet', 'City', 'Revenue', 'Orders', 'Avg Bill', 'Cancelled']],
    body: payload.outletSalesBreakdown.map((row) => [
      row.outlet.name,
      row.outlet.city,
      formatInrPlain(row.revenue),
      row.ordersCount,
      formatInrPlain(row.avgBill),
      row.cancelledCount,
    ]),
  });

  const afterOutletsY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? afterTopY + 140;

  // 6. Latest 10 Billing Transactions Audit Snapshot
  const latestTen = [...payload.bills]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('6. Latest Billing Transactions (Audit Snapshot)', marginX, afterOutletsY + 22);

  autoTable(doc, {
    startY: afterOutletsY + 30,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 4 },
    head: [['Ref #', 'Time', 'Outlet', 'Channel', 'Mode', 'Status', 'Total']],
    body:
      latestTen.length > 0
        ? latestTen.map((b) => [
            `#${b.id.split('-').pop()?.slice(-6) || b.id.slice(-6)}`,
            format(new Date(b.createdAt), 'dd MMM HH:mm'),
            outletLookup.get(b.outletId) || b.outletId,
            b.orderType === 'Dine-in' ? `Dine-in T${b.tableNo || 'N/A'}` : b.source,
            b.payments[0]?.mode || 'Cash',
            b.status,
            formatInrPlain(b.total),
          ])
        : [['-', '-', 'No bills in range', '-', '-', '-', '-']],
  });

  // Page numbers footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Petpooja Multi-Outlet POS Analytics · Page ${i} of ${totalPages}`,
      marginX,
      doc.internal.pageSize.getHeight() - 20
    );
  }

  const filename = `petpooja-dashboard-${sanitizeFileSlug(payload.outletScopeLabel)}-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`;
  const pdfBlob = doc.output('blob');
  triggerFileDownload(pdfBlob, filename);
  return filename;
}
