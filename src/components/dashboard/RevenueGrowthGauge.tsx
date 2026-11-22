/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RevenueGrowthGaugeProps {
  growth: number; // percentage
  title?: string;
  className?: string;
}

export const RevenueGrowthGauge: React.FC<RevenueGrowthGaugeProps> = ({ 
  growth, 
  title = "MoM Revenue Growth",
  className 
}) => {
  // Normalize growth for the gauge (0 to 100)
  // Let's assume we want to show growth in a range of -50% to +50% for visual effect
  // or just 0 to 100 if we treat it as a target.
  // Actually, a radial gauge usually represents a percentage of a whole.
  // For MoM growth, let's use a centered gauge or just a circular progress.
  
  const value = Math.min(Math.max(growth, -100), 100);
  const data = [
    {
      name: 'Growth',
      value: Math.abs(value),
      fill: value >= 0 ? '#10b981' : '#ef4444',
    },
  ];

  const isPositive = growth >= 0;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center pt-0">
        <div className="relative w-full h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart 
              cx="50%" 
              cy="50%" 
              innerRadius="70%" 
              outerRadius="100%" 
              barSize={10} 
              data={data}
              startAngle={180}
              endAngle={0}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                background
                dataKey="value"
                cornerRadius={5}
                animationDuration={1500}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center mt-6">
            <span className={cn(
              "text-2xl font-bold tabular-nums",
              isPositive ? "text-emerald-600" : "text-red-600"
            )}>
              {isPositive ? '+' : ''}{growth.toFixed(1)}%
            </span>
            <div className="flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="w-3 h-3 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                vs last month
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
