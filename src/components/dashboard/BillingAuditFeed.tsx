/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Pause,
  Play,
  Printer,
  Receipt,
  Send,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';

import { Bill } from '@/types';
import { STAFF } from '@/lib/mock-data';
import { cn, formatCurrency } from '@/lib/utils';
import { useDashboard } from '@/hooks/use-dashboard';
import { Button } from '@/components/ui/button';
import { BillReceiptDialog } from '@/components/common/BillReceiptDialog';
import { BillReviewQrBlock } from '@/components/common/BillReviewQrBlock';
import { normalizeIndianPhone, printThermalReceipt } from '@/lib/receipt-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BillingAuditFeedProps {
  bills: Bill[];
  className?: string;
}

const STATUS_META: Record<
  Bill['status'],
  { textClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Paid: {
    textClass: 'text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  Served: {
    textClass: 'text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  Placed: {
    textClass: 'text-blue-600 dark:text-blue-400',
    icon: Clock,
  },
  Preparing: {
    textClass: 'text-amber-600 dark:text-amber-400',
    icon: AlertCircle,
  },
  Cancelled: {
    textClass: 'text-rose-600 dark:text-rose-400',
    icon: XCircle,
  },
};

export const BillingAuditFeed: React.FC<BillingAuditFeedProps> = ({ bills, className }) => {
  const { outlets, isLiveFeedPaused } = useDashboard();
  const [isPaused, setIsPaused] = React.useState(false);
  const [pausedSnapshot, setPausedSnapshot] = React.useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = React.useState<Bill | null>(null);
  const [receiptBill, setReceiptBill] = React.useState<Bill | null>(null);
  const [receiptTab, setReceiptTab] = React.useState<'actions' | 'review'>('actions');
  const [nowTick, setNowTick] = React.useState(() => Date.now());

  // Refresh relative timestamps every 10 seconds
  React.useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const liveLatestFive = React.useMemo(() => {
    return [...bills]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [bills]);

  const displayedBills = isPaused ? pausedSnapshot : liveLatestFive;

  const queuedCount = React.useMemo(() => {
    if (!isPaused || pausedSnapshot.length === 0) return 0;
    const latestPausedTime = new Date(pausedSnapshot[0].createdAt).getTime();
    return bills.filter((b) => new Date(b.createdAt).getTime() > latestPausedTime).length;
  }, [isPaused, pausedSnapshot, bills]);

  const handleTogglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      setPausedSnapshot([]);
    } else {
      setPausedSnapshot(liveLatestFive);
      setIsPaused(true);
    }
  };

  const getOutletName = React.useCallback(
    (outletId: string) => outlets.find((o) => o.id === outletId)?.name || outletId,
    [outlets]
  );

  const getStaffName = React.useCallback((staffId: string) => {
    const found = STAFF.find((s) => s.id === staffId);
    return found ? found.name : 'POS Cashier';
  }, []);

  const auditBatchTotal = React.useMemo(() => {
    return displayedBills.reduce(
      (sum, bill) => sum + (bill.status === 'Cancelled' ? 0 : bill.total),
      0
    );
  }, [displayedBills]);

  return (
    <>
      <section
        aria-label="Real-time billing audit feed"
        className={cn(
          'flex flex-col h-full bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500 shrink-0" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                Billing Audit Feed
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Latest 5 transactions · {isPaused || isLiveFeedPaused ? 'Stream paused' : 'Real-time ledger'}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTogglePause}
            className="h-8 px-2.5 text-xs gap-1.5 shrink-0 border-slate-200 dark:border-neutral-700"
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-600" />
                <span>Resume{queuedCount > 0 ? ` (${queuedCount})` : ''}</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-slate-500" />
                <span>Pause</span>
              </>
            )}
          </Button>
        </div>

        {/* 5 Latest Transactions List */}
        {displayedBills.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Receipt className="w-8 h-8 text-slate-300 dark:text-neutral-700 mb-2" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No billing transactions found
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Transactions matching your active outlet and date filter will stream here.
            </p>
          </div>
        ) : (
          <div className="flex-1 divide-y divide-slate-100 dark:divide-neutral-800 overflow-y-auto">
            <AnimatePresence initial={false}>
              {displayedBills.map((bill) => {
                const statusMeta = STATUS_META[bill.status] || STATUS_META.Paid;
                const StatusIcon = statusMeta.icon;
                const createdDate = new Date(bill.createdAt);
                const isFresh = nowTick - createdDate.getTime() < 15000;
                const primaryPaymentMode = bill.payments[0]?.mode || 'Cash';
                const shortRef = bill.id.split('-').pop()?.slice(-6) || bill.id.slice(-6);

                return (
                  <motion.button
                    key={bill.id}
                    type="button"
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setSelectedBill(bill)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40',
                      isFresh && 'bg-orange-50/40 dark:bg-orange-500/5'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100">
                          #{shortRef}
                        </span>
                        <span className="text-slate-300 dark:text-neutral-700" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate">
                          {format(createdDate, 'HH:mm:ss')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[11px] font-medium',
                            statusMeta.textClass
                          )}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {bill.status}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 dark:text-neutral-600 transition-colors" />
                      </div>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                        {getOutletName(bill.outletId)}
                      </p>
                      <span
                        className={cn(
                          'text-sm font-bold font-mono tabular-nums shrink-0',
                          bill.status === 'Cancelled'
                            ? 'text-slate-400 line-through'
                            : 'text-slate-900 dark:text-slate-100'
                        )}
                      >
                        {formatCurrency(bill.total)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate">
                        {primaryPaymentMode}
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        {bill.orderType === 'Dine-in'
                          ? `Table ${bill.tableNo || 'N/A'}`
                          : bill.source}
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        {bill.items.length} {bill.items.length === 1 ? 'item' : 'items'}
                      </span>
                      <span className="font-mono tabular-nums shrink-0">
                        {formatDistanceToNowStrict(createdDate, { addSuffix: true })}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Footer Audit Summary */}
        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-900 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            5-bill net total
          </span>
          <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrency(auditBatchTotal)}
          </span>
        </div>
      </section>

      {/* Transaction Audit Inspector Dialog */}
      <Dialog open={!!selectedBill} onOpenChange={(open) => !open && setSelectedBill(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
          {selectedBill && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between pr-6">
                  <span>Transaction Audit #{selectedBill.id.split('-').pop()?.slice(-6)}</span>
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      (STATUS_META[selectedBill.status] || STATUS_META.Paid).textClass
                    )}
                  >
                    {selectedBill.status}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {getOutletName(selectedBill.outletId)} ·{' '}
                  {format(new Date(selectedBill.createdAt), 'dd MMM yyyy, HH:mm:ss')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-xs">
                {/* Metadata Summary */}
                <div className="grid grid-cols-2 gap-3 py-2.5 border-y border-slate-200 dark:border-neutral-800">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Cashier / Staff</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {getStaffName(selectedBill.staffId)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Channel</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {selectedBill.orderType} ({selectedBill.source}
                      {selectedBill.tableNo ? ` · T${selectedBill.tableNo}` : ''})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Payment Mode</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {selectedBill.payments.map((p) => p.mode).join(', ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Bill ID</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 break-all">
                      {selectedBill.id}
                    </span>
                  </div>
                  {(selectedBill.customerName || selectedBill.customerPhone) && (
                    <div className="col-span-2">
                      <span className="text-slate-500 dark:text-slate-400 block">Customer</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {selectedBill.customerName || 'Guest'}
                        {selectedBill.customerPhone
                          ? ` · ${normalizeIndianPhone(selectedBill.customerPhone)}`
                          : ''}
                      </span>
                    </div>
                  )}
                </div>

                {selectedBill.status === 'Cancelled' && selectedBill.cancellationReason && (
                  <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-rose-700 dark:text-rose-300">
                    Cancellation reason: {selectedBill.cancellationReason}
                  </div>
                )}

                {/* Line Items */}
                <div className="max-h-44 overflow-y-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-neutral-800 text-slate-500 dark:text-slate-400">
                        <th className="py-1.5 text-left font-medium">Item</th>
                        <th className="py-1.5 text-right font-medium">Qty</th>
                        <th className="py-1.5 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                      {selectedBill.items.map((item, idx) => (
                        <tr key={`${item.itemId}-${idx}`}>
                          <td className="py-2 pr-2 text-slate-800 dark:text-slate-200">
                            {item.name}
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums text-slate-500">
                            ×{item.qty}
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                            {formatCurrency(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Ledger */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-neutral-800">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(selectedBill.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>GST (5%)</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(selectedBill.tax)}
                    </span>
                  </div>
                  {selectedBill.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discount</span>
                      <span className="font-mono tabular-nums">
                        -{formatCurrency(selectedBill.discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-100 dark:border-neutral-800">
                    <span>Net Bill Total</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(selectedBill.total)}
                    </span>
                  </div>
                </div>

                <BillReviewQrBlock
                  bill={selectedBill}
                  onOpenReview={() => {
                    const target = selectedBill;
                    setSelectedBill(null);
                    setReceiptTab('review');
                    setReceiptBill(target);
                  }}
                />
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={async () => {
                      const outlet = outlets.find((o) => o.id === selectedBill.outletId);
                      const ok = await printThermalReceipt({ bill: selectedBill, outlet });
                      if (ok) {
                        toast.success('Print dialog opened for receipt.');
                      }
                    }}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={() => {
                      const target = selectedBill;
                      setSelectedBill(null);
                      setReceiptTab('actions');
                      setReceiptBill(target);
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Receipt
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedBill(null)}
                  className="text-xs"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <BillReceiptDialog
        bill={receiptBill}
        open={!!receiptBill}
        onOpenChange={(open) => !open && setReceiptBill(null)}
        initialFocus={receiptTab === 'actions' ? 'send' : 'preview'}
        initialTab={receiptTab}
      />
    </>
  );
};
