/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { Bill } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDashboard } from '@/hooks/use-dashboard';
import { BillReceiptDialog } from '@/components/common/BillReceiptDialog';
import { Printer } from 'lucide-react';

interface LiveOrdersFeedProps {
  bills: Bill[];
}

const STATUS_VARIANTS: Record<string, string> = {
  'Placed': 'bg-blue-100 text-blue-700 border-blue-200',
  'Preparing': 'bg-amber-100 text-amber-700 border-amber-200',
  'Served': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Paid': 'bg-slate-100 text-slate-700 border-slate-200',
  'Cancelled': 'bg-rose-100 text-rose-700 border-rose-200',
};

export const LiveOrdersFeed: React.FC<LiveOrdersFeedProps> = ({ bills }) => {
  const { outlets, isLiveFeedPaused } = useDashboard();
  const [receiptBill, setReceiptBill] = React.useState<Bill | null>(null);

  const getOutletName = React.useCallback(
    (outletId: string) => outlets.find((o) => o.id === outletId)?.name || outletId,
    [outlets]
  );

  // Take last 15 bills
  const recentBills = [...bills].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 15);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Live Orders</h3>
        <Badge
          variant="outline"
          className={cn(
            isLiveFeedPaused
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-emerald-50 text-emerald-600 border-emerald-200 animate-pulse"
          )}
        >
          {isLiveFeedPaused ? 'Paused' : 'Live'}
        </Badge>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          <AnimatePresence initial={false}>
            {recentBills.map((bill) => (
              <motion.div
                key={bill.id}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => setReceiptBill(bill)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setReceiptBill(bill);
                  }
                }}
                className={cn(
                  "p-3 bg-slate-50 border border-slate-100 rounded-lg group hover:border-orange-200 hover:bg-white transition-all cursor-pointer",
                  (new Date().getTime() - new Date(bill.createdAt).getTime() < 10000) && "animate-order-highlight"
                )}
              >
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="text-xs font-semibold text-orange-600 truncate">
                    {getOutletName(bill.outletId)}
                  </span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0",
                    STATUS_VARIANTS[bill.status] || 'bg-slate-100 text-slate-600'
                  )}>
                    {bill.status}
                  </span>
                </div>
                
                {bill.isHighPriority && (
                  <div className="mb-2 flex items-center gap-2">
                    <Badge className="bg-orange-500 text-white border-orange-600 text-[9px] py-0 px-1.5 h-4 uppercase font-bold animate-pulse">
                      High Priority
                    </Badge>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800">
                      {bill.orderType === 'Dine-in' ? `Table ${bill.tableNo || 'N/A'}` : bill.source} • {bill.orderType}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      #{bill.id.split('-').pop()} • {format(new Date(bill.createdAt), 'HH:mm:ss')} • {bill.items.length} items
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatCurrency(bill.total)}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 group-hover:text-orange-600 transition-colors">
                      <Printer className="w-2.5 h-2.5" />
                      Receipt
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <BillReceiptDialog
        bill={receiptBill}
        open={!!receiptBill}
        onOpenChange={(open) => !open && setReceiptBill(null)}
        initialFocus="preview"
      />
    </div>
  );
};
