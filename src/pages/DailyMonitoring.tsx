/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";

import { useDashboard } from '@/hooks/use-dashboard';
import { DataTable } from '@/components/common/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { format, eachDayOfInterval, isSameDay } from 'date-fns';
import { formatDateRangeLabel } from '@/components/common/DateRangePicker';
import { formatCurrency } from '@/lib/utils';
import { Bill } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

interface DailyStats {
  date: string;
  totalSales: number;
  orderCount: number;
  cancelledCount: number;
  avgOrderValue: number;
}

export const DailyMonitoring: React.FC = () => {
  const { bills, dateRange } = useDashboard();

  const dailyData = React.useMemo(() => {
    const days = eachDayOfInterval({
      start: dateRange.from,
      end: dateRange.to,
    });

    return days.map(day => {
      const dayBills = bills.filter(b => isSameDay(new Date(b.createdAt), day));
      const successfulBills = dayBills.filter(b => b.status !== 'Cancelled');
      const totalSales = successfulBills.reduce((acc, b) => acc + b.total, 0);
      
      return {
        date: format(day, 'MMM d'),
        fullDate: format(day, 'yyyy-MM-dd'),
        totalSales,
        orderCount: dayBills.length,
        cancelledCount: dayBills.filter(b => b.status === 'Cancelled').length,
        avgOrderValue: successfulBills.length > 0 ? totalSales / successfulBills.length : 0,
      };
    });
  }, [bills, dateRange]);

  const columns: ColumnDef<any, any>[] = [
    {
      accessorKey: "fullDate",
      header: "Date",
      cell: ({ row }) => format(new Date(row.getValue<string>("fullDate")), 'eeee, MMM d')
    },
    {
      accessorKey: "orderCount",
      header: "Total Orders",
    },
    {
      accessorKey: "cancelledCount",
      header: "Cancelled",
      cell: ({ row }) => (
        <span className={row.getValue<number>("cancelledCount") > 0 ? "text-rose-500 font-medium" : "text-slate-400"}>
          {row.getValue<number>("cancelledCount")}
        </span>
      )
    },
    {
      accessorKey: "totalSales",
      header: "Net Sales",
      cell: ({ row }) => <span className="font-bold">{formatCurrency(row.getValue<number>("totalSales"))}</span>
    },
    {
      accessorKey: "avgOrderValue",
      header: "Avg Order",
      cell: ({ row }) => formatCurrency(row.getValue<number>("avgOrderValue"))
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Day-to-Day Monitoring</h2>
        <p className="text-slate-500 text-sm">
          Daily sales and order performance for {formatDateRangeLabel(dateRange.from, dateRange.to)} ({dailyData.length} day{dailyData.length === 1 ? '' : 's'}).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Sales Trend</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `₹${val/1000}k`} />
              <Tooltip 
                formatter={(val: any) => [formatCurrency(Number(val)), 'Sales']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="totalSales" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={[...dailyData].reverse()} searchPlaceholder="Search by date..." />
    </div>
  );
};
