/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  change: number;
  prefix?: string;
  isCurrency?: boolean;
  sparklineData?: number[];
}

export const KpiCard: React.FC<KpiCardProps> = ({ 
  title, 
  value, 
  change, 
  isCurrency,
  sparklineData 
}) => {
  const isPositive = change >= 0;
  
  // Use provided data or fallback to a simple visual
  const data = sparklineData || [30, 45, 35, 60, 55, 70, 65, 80];
  const max = Math.max(...data);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <div className="flex items-end justify-between">
          <div>
            <h3 className="text-2xl font-bold tracking-tight tabular-nums">
              {isCurrency ? formatCurrency(Number(value)) : value}
            </h3>
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium mt-1",
              isPositive ? "text-emerald-600" : "text-rose-600"
            )}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{Math.abs(change)}%</span>
              <span className="text-slate-400 font-normal ml-1">vs prev. period</span>
            </div>
          </div>
          
          {/* Sparkline Visualization */}
          <div className="h-8 w-16 flex items-end gap-0.5 px-0.5">
            {data.map((val, i) => (
              <div 
                key={i} 
                className={cn(
                  "w-full rounded-t-[1px] transition-all duration-500",
                  isPositive ? "bg-emerald-500/20" : "bg-rose-500/20",
                  i === data.length - 1 && (isPositive ? "bg-emerald-500" : "bg-rose-500")
                )} 
                style={{ height: `${(val / max) * 100}%` }} 
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
