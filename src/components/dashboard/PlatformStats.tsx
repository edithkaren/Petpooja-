/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Bill, OrderSource } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency, cn } from '@/lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, Legend, PieChart, Pie 
} from 'recharts';

interface PlatformStatsProps {
  bills: Bill[];
}

const PLATFORM_COLORS: Record<OrderSource, string> = {
  'Direct': '#10b981', // Emerald
  'Swiggy': '#f97316', // Orange
  'Zomato': '#e11d48', // Rose
  'Magicpin': '#3b82f6', // Blue
};

export const PlatformStats: React.FC<PlatformStatsProps> = ({ bills }) => {
  const stats = useMemo(() => {
    const data: Record<OrderSource, { name: string, total: number, orders: number, cancelled: number }> = {
      'Direct': { name: 'Direct', total: 0, orders: 0, cancelled: 0 },
      'Swiggy': { name: 'Swiggy', total: 0, orders: 0, cancelled: 0 },
      'Zomato': { name: 'Zomato', total: 0, orders: 0, cancelled: 0 },
      'Magicpin': { name: 'Magicpin', total: 0, orders: 0, cancelled: 0 },
    };

    bills.forEach(bill => {
      const source = bill.source;
      data[source].orders += 1;
      if (bill.status === 'Cancelled') {
        data[source].cancelled += 1;
      } else {
        data[source].total += bill.total;
      }
    });

    return Object.values(data);
  }, [bills]);

  const pieData = stats.map(s => ({ name: s.name, value: s.orders }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Orders by Platform</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={PLATFORM_COLORS[entry.name as OrderSource]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales vs Cancellations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {stats.map((s) => {
              const cancelPct = s.orders > 0 ? ((s.cancelled / s.orders) * 100).toFixed(1) : '0.0';
              const maxTotal = Math.max(1, ...stats.map((x) => x.total));
              const totalPct = (s.total / maxTotal) * 100;
              const cancelBarPct = s.orders > 0 ? (s.cancelled / s.orders) * 100 : 0;

              return (
              <div key={s.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[s.name as OrderSource] }} />
                    <span className="font-medium text-slate-700">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-500">Orders: {s.orders}</span>
                    <span className="text-rose-500 font-medium">
                      Cancelled: {s.cancelled} ({cancelPct}%)
                    </span>
                    <span className="font-bold text-slate-900">{formatCurrency(s.total)}</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-slate-400" 
                    style={{ 
                      width: `${totalPct}%`,
                      backgroundColor: PLATFORM_COLORS[s.name as OrderSource]
                    }} 
                  />
                  <div 
                    className="h-full bg-rose-200" 
                    style={{ 
                      width: `${cancelBarPct}%`
                    }} 
                  />
                </div>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
