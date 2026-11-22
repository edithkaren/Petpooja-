/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";

import { useDashboard } from '@/hooks/use-dashboard';
import { DataTable } from '@/components/common/DataTable';
import { Bill } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Printer, Download, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateRangeLabel } from '@/components/common/DateRangePicker';
import { BillReceiptDialog } from '@/components/common/BillReceiptDialog';
import { BillReviewQrBlock } from '@/components/common/BillReviewQrBlock';
import { normalizeIndianPhone, printThermalReceipt } from '@/lib/receipt-utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const Sales: React.FC = () => {
  const { bills, outlets, dateRange } = useDashboard();
  const [selectedBill, setSelectedBill] = React.useState<Bill | null>(null);
  const [receiptBill, setReceiptBill] = React.useState<Bill | null>(null);
  const [receiptFocus, setReceiptFocus] = React.useState<'preview' | 'send'>('send');
  const [receiptTab, setReceiptTab] = React.useState<'actions' | 'review'>('actions');

  const periodTotal = React.useMemo(
    () => bills.reduce((sum, b) => sum + (b.status === 'Cancelled' ? 0 : b.total), 0),
    [bills]
  );

  const handleExportSales = () => {
    const headers = ['Bill ID', 'Created At', 'Order Type', 'Source', 'Payment Mode', 'Total', 'Status'];
    const rows = bills.map((b) => [
      b.id,
      b.createdAt,
      b.orderType,
      b.source,
      b.payments[0]?.mode || 'N/A',
      b.total.toFixed(2),
      b.status,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `sales-history-${format(dateRange.from, 'yyyyMMdd')}-${format(dateRange.to, 'yyyyMMdd')}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${bills.length} sales records.`);
  };

  const columns: ColumnDef<Bill, any>[] = [
    {
      accessorKey: "id",
      header: "Bill No",
      cell: ({ row }) => <span className="font-mono font-medium">#{row.getValue<string>("id").split('-').pop()}</span>
    },
    {
      accessorKey: "createdAt",
      header: "Time",
      cell: ({ row }) => format(new Date(row.getValue<string>("createdAt")), 'MMM d, HH:mm')
    },
    {
      accessorKey: "orderType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal">
          {row.getValue<string>("orderType")}
        </Badge>
      )
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-2 h-2 rounded-full",
            row.getValue<string>("source") === 'Swiggy' ? "bg-orange-500" :
            row.getValue<string>("source") === 'Zomato' ? "bg-rose-500" :
            row.getValue<string>("source") === 'Magicpin' ? "bg-blue-500" :
            "bg-emerald-500"
          )} />
          <span>{row.getValue<string>("source")}</span>
        </div>
      )
    },
    {
      accessorKey: "tableNo",
      header: "Table/Details",
      cell: ({ row }) => (
        <span className="text-slate-500">
          {row.original.orderType === 'Dine-in' ? `Table ${row.original.tableNo}` : row.original.orderType}
        </span>
      )
    },
    {
      accessorKey: "items",
      header: "Items",
      cell: ({ row }) => row.original.items.length
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => <span className="font-bold tabular-nums">{formatCurrency(row.getValue<number>("total"))}</span>
    },
    {
      accessorKey: "payments",
      header: "Payment",
      cell: ({ row }) => row.original.payments[0]?.mode
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue<string>("status");
        return (
          <Badge className={cn(
            "font-normal",
            status === 'Paid' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-blue-50 text-blue-700 border-blue-100"
          )}>
            {status}
          </Badge>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales History</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {bills.length.toLocaleString('en-IN')} bills · {formatCurrency(periodTotal)} net sales for{' '}
            <span className="font-medium text-slate-700">{formatDateRangeLabel(dateRange.from, dateRange.to)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportSales}>
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={bills} 
        searchPlaceholder="Search by bill ID..." 
        onRowClick={(bill) => setSelectedBill(bill)}
      />

      <Sheet open={!!selectedBill} onOpenChange={(open) => !open && setSelectedBill(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selectedBill && (
            <div className="space-y-6 py-4">
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-xl">Bill Details</SheetTitle>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-normal">
                    {selectedBill.status}
                  </Badge>
                </div>
                <SheetDescription className="font-mono uppercase text-[10px] tracking-widest">
                  ID: {selectedBill.id}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Date & Time</span>
                  <span className="text-slate-900">{format(new Date(selectedBill.createdAt), 'PPpp')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Order Type</span>
                  <span className="text-slate-900">{selectedBill.orderType}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Table No</span>
                  <span className="text-slate-900">{selectedBill.tableNo || 'N/A'}</span>
                </div>
                {(selectedBill.customerName || selectedBill.customerPhone) && (
                  <div className="flex justify-between text-slate-500">
                    <span>Customer</span>
                    <span className="text-slate-900 text-right">
                      {selectedBill.customerName || 'Guest'}
                      {selectedBill.customerPhone
                        ? ` · ${normalizeIndianPhone(selectedBill.customerPhone)}`
                        : ''}
                    </span>
                  </div>
                )}
                {selectedBill.status === 'Cancelled' && (
                  <div className="flex justify-between text-rose-600 font-medium pt-2">
                    <span>Reason</span>
                    <span>{selectedBill.cancellationReason || 'N/A'}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-400">Order Items</h4>
                <div className="space-y-3">
                  {selectedBill.items.map((item, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div className="flex gap-2">
                        <span className="text-slate-400 font-mono">{item.qty}x</span>
                        <span className="font-medium text-slate-800">{item.name}</span>
                      </div>
                      <span className="tabular-nums font-medium">{formatCurrency(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="text-slate-900 tabular-nums">{formatCurrency(selectedBill.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Taxes (5%)</span>
                  <span className="text-slate-900 tabular-nums">{formatCurrency(selectedBill.tax)}</span>
                </div>
                {selectedBill.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount</span>
                    <span className="tabular-nums">-{formatCurrency(selectedBill.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2">
                  <span>Total Amount</span>
                  <span className="text-slate-900 tabular-nums">{formatCurrency(selectedBill.total)}</span>
                </div>
              </div>

              <BillReviewQrBlock
                bill={selectedBill}
                onOpenReview={() => {
                  setReceiptTab('review');
                  setReceiptFocus('preview');
                  setReceiptBill(selectedBill);
                }}
              />

              <div className="pt-2 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={async () => {
                    const outlet = outlets.find((o) => o.id === selectedBill.outletId);
                    const ok = await printThermalReceipt({ bill: selectedBill, outlet });
                    if (ok) {
                      toast.success('Print dialog opened for bill receipt.');
                    } else {
                      setReceiptTab('actions');
                      setReceiptFocus('preview');
                      setReceiptBill(selectedBill);
                    }
                  }}
                >
                  <Printer className="w-4 h-4" /> Print
                </Button>
                <Button
                  type="button"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
                  onClick={() => {
                    setReceiptTab('actions');
                    setReceiptFocus('send');
                    setReceiptBill(selectedBill);
                  }}
                >
                  <Send className="w-4 h-4" /> Send Receipt
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <BillReceiptDialog
        bill={receiptBill}
        open={!!receiptBill}
        onOpenChange={(open) => !open && setReceiptBill(null)}
        initialFocus={receiptFocus}
        initialTab={receiptTab}
      />
    </div>
  );
};


