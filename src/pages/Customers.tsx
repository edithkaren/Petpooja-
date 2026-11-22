/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";

import { CUSTOMERS } from '@/lib/mock-data';
import { DataTable } from '@/components/common/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Customer } from '@/types';
import { Badge } from '@/components/ui/badge';
import { UserCircle, Heart, Calendar, CreditCard } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboard } from '@/hooks/use-dashboard';
import { formatDateRangeLabel } from '@/components/common/DateRangePicker';
import { isWithinInterval } from 'date-fns';

const SEGMENT_COLORS: Record<string, string> = {
  'VIP': 'bg-purple-50 text-purple-700 border-purple-100',
  'Repeat': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'New': 'bg-blue-50 text-blue-700 border-blue-100',
  'Lapsed': 'bg-slate-100 text-slate-500 border-slate-200',
};

export const Customers: React.FC = () => {
  const { dateRange, bills } = useDashboard();
  const [customerScope, setCustomerScope] = React.useState<'period' | 'all'>('period');

  const periodCustomers = React.useMemo(
    () =>
      CUSTOMERS.filter((c) =>
        isWithinInterval(new Date(c.lastVisitAt), {
          start: dateRange.from,
          end: dateRange.to,
        })
      ),
    [dateRange]
  );

  const displayedCustomers = customerScope === 'period' ? periodCustomers : CUSTOMERS;

  const stats = React.useMemo(() => {
    const vipCount = displayedCustomers.filter((c) => c.segment === 'VIP').length;
    const newCount = displayedCustomers.filter((c) => c.segment === 'New').length;
    const avgLtv =
      displayedCustomers.length > 0
        ? displayedCustomers.reduce((s, c) => s + c.lifetimeSpend, 0) / displayedCustomers.length
        : 0;
    const periodOrders = bills.filter((b) => b.status !== 'Cancelled').length;
    return { vipCount, newCount, avgLtv, periodOrders };
  }, [displayedCustomers, bills]);
  const columns: ColumnDef<Customer, any>[] = [
    {
      accessorKey: "name",
      header: "Customer",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <UserCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{row.getValue<string>("name")}</p>
            <p className="text-[10px] text-slate-400 font-mono">{row.original.phone}</p>
          </div>
        </div>
      )
    },
    {
      accessorKey: "segment",
      header: "Segment",
      cell: ({ row }) => {
        const segment = row.getValue<string>("segment");
        return (
          <Badge className={cn("font-normal", SEGMENT_COLORS[segment])}>
            {segment}
          </Badge>
        );
      }
    },
    {
      accessorKey: "visits",
      header: "Visits",
      cell: ({ row }) => <span className="font-mono">{row.getValue<number>("visits")}</span>
    },
    {
      accessorKey: "lifetimeSpend",
      header: "Lifetime Spend",
      cell: ({ row }) => <span className="font-bold tabular-nums">{formatCurrency(row.getValue<number>("lifetimeSpend"))}</span>
    },
    {
      accessorKey: "lastVisitAt",
      header: "Last Visit",
      cell: ({ row }) => new Date(row.getValue<string>("lastVisitAt")).toLocaleDateString()
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customer Relationships</h2>
          <p className="text-slate-500 text-sm">
            {customerScope === 'period'
              ? `${periodCustomers.length} customers active during ${formatDateRangeLabel(dateRange.from, dateRange.to)}`
              : `Showing all ${CUSTOMERS.length} CRM customers`}
          </p>
        </div>
        <Tabs value={customerScope} onValueChange={(v) => setCustomerScope(v as 'period' | 'all')}>
          <TabsList className="bg-slate-100">
            <TabsTrigger value="period" className="text-xs">
              Active in Period ({periodCustomers.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              All Customers ({CUSTOMERS.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">VIP Customers</p>
              <p className="text-xl font-bold font-mono tabular-nums">{stats.vipCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Orders in Range</p>
              <p className="text-xl font-bold font-mono tabular-nums">{stats.periodOrders.toLocaleString('en-IN')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <UserCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">New Signups</p>
              <p className="text-xl font-bold font-mono tabular-nums">{stats.newCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Avg Lifetime Value</p>
              <p className="text-xl font-bold font-mono tabular-nums">{formatCurrency(stats.avgLtv)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable columns={columns} data={displayedCustomers} searchPlaceholder="Search customers by name or phone..." />
    </div>
  );
};
