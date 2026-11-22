/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { format } from 'date-fns';
import {
  Check,
  CheckCircle2,
  Copy,
  MessageSquare,
  Phone,
  Printer,
  QrCode,
  Send,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';

import { Bill } from '@/types';
import { useDashboard } from '@/hooks/use-dashboard';
import { cn, formatCurrency } from '@/lib/utils';
import {
  buildCustomerReviewUrl,
  buildOrderDetailsQrPayload,
  buildReceiptText,
  DEFAULT_REVIEW_HEADING,
  DEFAULT_REVIEW_PROMPT,
  DEFAULT_THANK_YOU_MESSAGE,
  getBillShortRef,
  getOrderBarcodeValue,
  isValidPhoneNumber,
  normalizeIndianPhone,
  printThermalReceipt,
  ReceiptPaperFormat,
} from '@/lib/receipt-utils';
import { encodeCode128B, generateQrDataUrl } from '@/lib/barcode-utils';
import { BillReview, getBillReview } from '@/lib/bill-reviews';
import { CustomerReviewView } from '@/components/common/CustomerReviewView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type DeliveryChannel = 'WhatsApp' | 'SMS';
type RightPanelTab = 'actions' | 'review';

interface SentReceiptRecord {
  billId: string;
  phone: string;
  channel: DeliveryChannel;
  sentAt: string;
}

interface BillReceiptDialogProps {
  bill: Bill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFocus?: 'preview' | 'send';
  initialTab?: RightPanelTab;
}

export const BillReceiptDialog: React.FC<BillReceiptDialogProps> = ({
  bill,
  open,
  onOpenChange,
  initialFocus = 'preview',
  initialTab = 'actions',
}) => {
  const { outlets } = useDashboard();
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [channel, setChannel] = React.useState<DeliveryChannel>('WhatsApp');
  const [thankYouMessage, setThankYouMessage] = React.useState(DEFAULT_THANK_YOU_MESSAGE);
  const [includeReviewQr, setIncludeReviewQr] = React.useState(true);
  const [reviewPrompt, setReviewPrompt] = React.useState(DEFAULT_REVIEW_PROMPT);
  const [paperFormat, setPaperFormat] = React.useState<ReceiptPaperFormat>('80mm');
  const [rightTab, setRightTab] = React.useState<RightPanelTab>('actions');
  const [copied, setCopied] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [sentRecord, setSentRecord] = React.useState<SentReceiptRecord | null>(null);
  const [orderQrUrl, setOrderQrUrl] = React.useState<string>('');
  const [reviewQrUrl, setReviewQrUrl] = React.useState<string>('');
  const [submittedReview, setSubmittedReview] = React.useState<BillReview | null>(null);

  const phoneInputRef = React.useRef<HTMLInputElement | null>(null);

  const outlet = React.useMemo(
    () => (bill ? outlets.find((o) => o.id === bill.outletId) : undefined),
    [bill, outlets]
  );

  React.useEffect(() => {
    if (!bill || !open) return;
    setCustomerPhone(bill.customerPhone || '');
    setThankYouMessage(DEFAULT_THANK_YOU_MESSAGE);
    setReviewPrompt(DEFAULT_REVIEW_PROMPT);
    setIncludeReviewQr(true);
    setRightTab(initialTab);
    setCopied(false);
    setSentRecord(null);
    setSubmittedReview(getBillReview(bill.id));
    if (initialFocus === 'send' && initialTab === 'actions') {
      setTimeout(() => phoneInputRef.current?.focus(), 80);
    }
  }, [bill, open, initialFocus, initialTab]);

  React.useEffect(() => {
    if (!bill || !open) return;
    let active = true;

    const orderPayload = buildOrderDetailsQrPayload(bill, outlet);
    const reviewUrl = buildCustomerReviewUrl(bill);

    Promise.all([
      generateQrDataUrl(orderPayload, 160),
      generateQrDataUrl(reviewUrl, 160),
    ])
      .then(([orderUrl, revUrl]) => {
        if (!active) return;
        setOrderQrUrl(orderUrl);
        setReviewQrUrl(revUrl);
      })
      .catch(() => {
        if (!active) return;
        setOrderQrUrl('');
        setReviewQrUrl('');
      });

    return () => {
      active = false;
    };
  }, [bill, outlet, open]);

  const barcodeLayout = React.useMemo(() => {
    if (!bill) return null;
    return encodeCode128B(getOrderBarcodeValue(bill), 42, 1.5);
  }, [bill]);

  if (!bill) return null;

  const shortRef = getBillShortRef(bill.id);
  const paymentModes = bill.payments.map((p) => p.mode).join(', ') || 'Cash';

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const started = await printThermalReceipt({
        bill,
        outlet,
        customerPhone,
        thankYouMessage,
        includeReviewQr,
        reviewPrompt,
        paperFormat,
      });
      if (started) {
        toast.success(`Print dialog opened for receipt #${shortRef}`);
      } else {
        toast.error('Unable to prepare printable receipt.');
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopyText = async () => {
    const text = buildReceiptText({
      bill,
      outlet,
      customerPhone,
      thankYouMessage,
      includeReviewQr,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Receipt text copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Clipboard access unavailable');
    }
  };

  const handleSendToCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhoneNumber(customerPhone)) {
      toast.error('Please enter a valid 10-digit customer mobile number.');
      phoneInputRef.current?.focus();
      return;
    }

    const formattedPhone = normalizeIndianPhone(customerPhone);
    setSentRecord({
      billId: bill.id,
      phone: formattedPhone,
      channel,
      sentAt: new Date().toISOString(),
    });
    toast.success(
      `Receipt #${shortRef} sent via ${channel} to ${formattedPhone} with "${thankYouMessage.trim() || DEFAULT_THANK_YOU_MESSAGE}"`
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 max-h-[92vh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="flex items-center gap-2.5 text-lg">
                <span>Order Bill & Receipt · #{shortRef}</span>
                {submittedReview && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {submittedReview.rating}/5 Guest Review
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {outlet ? `${outlet.name} (${outlet.city})` : bill.outletId} ·{' '}
                {format(new Date(bill.createdAt), 'dd MMM yyyy, HH:mm:ss')}
              </DialogDescription>
            </div>
            <span className="font-mono text-base font-bold tabular-nums text-orange-600 dark:text-orange-400">
              {formatCurrency(bill.total)}
            </span>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 pt-1 items-start">
          {/* Left: Spacious Print Preview with Barcode & QR Codes */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Print Preview
              </span>
              <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-neutral-800 p-0.5 text-[11px]">
                {(
                  [
                    { id: '80mm', label: '80mm POS Roll' },
                    { id: 'wide', label: 'Wide Invoice' },
                  ] as const
                ).map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setPaperFormat(fmt.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
                      paperFormat === fmt.id
                        ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                    )}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-100/70 dark:bg-neutral-950 p-3 sm:p-4 max-h-[64vh] overflow-y-auto flex justify-center">
              <div
                className={cn(
                  'w-full rounded-lg border border-dashed border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 sm:p-6 font-mono text-xs text-slate-800 dark:text-slate-200 shadow-xs space-y-4 transition-all',
                  paperFormat === '80mm' ? 'max-w-[390px]' : 'max-w-full'
                )}
              >
                {/* Store Header */}
                <div className="text-center border-b border-dashed border-slate-300 dark:border-neutral-700 pb-3">
                  <p className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {outlet?.name || 'Petpooja POS'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {outlet?.city || 'Indore'} · Tax Invoice &amp; Order Receipt
                  </p>
                </div>

                {/* Bill Metadata */}
                <div
                  className={cn(
                    'grid gap-x-4 gap-y-1 text-[11px]',
                    paperFormat === 'wide' ? 'grid-cols-2' : 'grid-cols-1'
                  )}
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Bill No</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      #{shortRef}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Date</span>
                    <span className="tabular-nums">
                      {format(new Date(bill.createdAt), 'dd MMM yyyy, HH:mm')}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Channel</span>
                    <span>
                      {bill.orderType}
                      {bill.tableNo ? ` · Table ${bill.tableNo}` : ` · ${bill.source}`}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Status</span>
                    <span className="font-medium">{bill.status}</span>
                  </div>
                  {bill.customerName && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Guest</span>
                      <span className="truncate max-w-[175px]">{bill.customerName}</span>
                    </div>
                  )}
                  {customerPhone && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Mobile</span>
                      <span className="tabular-nums">
                        {normalizeIndianPhone(customerPhone)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Full Itemized Table */}
                <div className="border-t border-dashed border-slate-300 dark:border-neutral-700 pt-3">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-dashed border-slate-300 dark:border-neutral-700 text-slate-500 dark:text-slate-400">
                        <th className="pb-1.5 text-left font-semibold">Item</th>
                        <th className="pb-1.5 text-right font-semibold">Qty</th>
                        <th className="pb-1.5 text-right font-semibold">Rate</th>
                        <th className="pb-1.5 text-right font-semibold">Amt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/70">
                      {bill.items.map((item, idx) => (
                        <tr key={`${item.itemId}-${idx}`}>
                          <td className="py-1.5 pr-2 leading-snug">{item.name}</td>
                          <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                            {item.qty}
                          </td>
                          <td className="py-1.5 text-right tabular-nums whitespace-nowrap text-slate-500 dark:text-slate-400">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">
                            {formatCurrency(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="border-t border-dashed border-slate-300 dark:border-neutral-700 pt-3 space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(bill.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>GST (5%)</span>
                    <span className="tabular-nums">{formatCurrency(bill.tax)}</span>
                  </div>
                  {bill.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discount</span>
                      <span className="tabular-nums">-{formatCurrency(bill.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Paid via</span>
                    <span>{paymentModes}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100 pt-2 mt-1 border-t border-dashed border-slate-300 dark:border-neutral-700">
                    <span>NET TOTAL</span>
                    <span className="tabular-nums">{formatCurrency(bill.total)}</span>
                  </div>
                </div>

                {/* Thank You Message */}
                <div className="pt-2.5 border-t border-dashed border-slate-300 dark:border-neutral-700 text-center">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {thankYouMessage.trim() || DEFAULT_THANK_YOU_MESSAGE}
                  </p>
                </div>

                {/* Scannable Code 128B Barcode */}
                {barcodeLayout && (
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200 text-center">
                    <svg
                      viewBox={`0 0 ${barcodeLayout.width} ${barcodeLayout.height}`}
                      className="w-full max-w-[260px] h-11 mx-auto block"
                      role="img"
                      aria-label={`Order barcode ${barcodeLayout.value}`}
                    >
                      {barcodeLayout.bars.map((bar, idx) => (
                        <rect
                          key={idx}
                          x={bar.x}
                          y={0}
                          width={bar.width}
                          height={barcodeLayout.height}
                          fill="#0f172a"
                        />
                      ))}
                    </svg>
                    <p className="text-[10px] tracking-[0.18em] text-slate-700 font-semibold mt-1">
                      {barcodeLayout.value}
                    </p>
                  </div>
                )}

                {/* Order Details QR + Customer Review QR */}
                <div
                  className={cn(
                    'grid gap-3 pt-1',
                    includeReviewQr ? 'grid-cols-2' : 'grid-cols-1'
                  )}
                >
                  <div className="rounded-lg border border-dashed border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-2.5 text-center space-y-1.5">
                    {orderQrUrl ? (
                      <img
                        src={orderQrUrl}
                        alt="Order details QR code"
                        className="w-24 h-24 mx-auto rounded bg-white p-1"
                      />
                    ) : (
                      <div className="w-24 h-24 mx-auto rounded bg-slate-100 flex items-center justify-center">
                        <QrCode className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                        Scan Order Details
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        Bill #{shortRef} · {bill.items.length} item(s)
                      </p>
                    </div>
                  </div>

                  {includeReviewQr && (
                    <div className="rounded-lg border border-dashed border-orange-300 dark:border-orange-500/40 bg-white dark:bg-neutral-950 p-2.5 text-center space-y-1.5">
                      {reviewQrUrl ? (
                        <img
                          src={reviewQrUrl}
                          alt="Customer review QR code"
                          className="w-24 h-24 mx-auto rounded bg-white p-1"
                        />
                      ) : (
                        <div className="w-24 h-24 mx-auto rounded bg-slate-100 flex items-center justify-center">
                          <QrCode className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                          {DEFAULT_REVIEW_HEADING}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                          {reviewPrompt.trim() || DEFAULT_REVIEW_PROMPT}
                        </p>
                        <button
                          type="button"
                          onClick={() => setRightTab('review')}
                          className="mt-1 text-[10px] font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                        >
                          Open review form →
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 pt-1">
                  Ref: {bill.id}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Delivery, Print Controls & QR Customer Review */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-neutral-800">
              <button
                type="button"
                onClick={() => setRightTab('actions')}
                className={cn(
                  'py-1.5 px-3 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer',
                  rightTab === 'actions'
                    ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                )}
              >
                <Send className="w-3.5 h-3.5" />
                Print &amp; Send
              </button>
              <button
                type="button"
                onClick={() => setRightTab('review')}
                className={cn(
                  'py-1.5 px-3 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer',
                  rightTab === 'review'
                    ? 'bg-white dark:bg-neutral-900 text-orange-600 dark:text-orange-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                )}
              >
                <Star className="w-3.5 h-3.5" />
                Guest Review QR
              </button>
            </div>

            {rightTab === 'review' ? (
              <div className="rounded-xl border border-slate-200 dark:border-neutral-800 p-4 bg-slate-50/50 dark:bg-neutral-950/40">
                <CustomerReviewView
                  billId={bill.id}
                  outletId={bill.outletId}
                  shortRef={shortRef}
                  customerName={bill.customerName}
                  embedded
                  onSubmitted={(review) => setSubmittedReview(review)}
                />
              </div>
            ) : (
              <form onSubmit={handleSendToCustomer} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="receipt-customer-phone" className="text-xs font-medium">
                    Customer Mobile Number
                  </Label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      ref={phoneInputRef}
                      id="receipt-customer-phone"
                      type="tel"
                      placeholder="e.g. 9826012345"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="pl-8 font-mono text-xs h-9"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {bill.customerName
                      ? `Pre-filled for ${bill.customerName} — edit anytime before sending.`
                      : 'Enter a 10-digit mobile number to deliver the digital bill.'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 block">
                    Delivery Channel
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-neutral-800">
                    {(['WhatsApp', 'SMS'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setChannel(mode)}
                        className={cn(
                          'py-1.5 px-3 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer',
                          channel === mode
                            ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        )}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="receipt-thank-you" className="text-xs font-medium">
                    Receipt Greeting Message
                  </Label>
                  <textarea
                    id="receipt-thank-you"
                    rows={2}
                    value={thankYouMessage}
                    onChange={(e) => setThankYouMessage(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-neutral-800 p-3 space-y-2.5 bg-slate-50/60 dark:bg-neutral-950/40">
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      Include Customer Review QR on Bill
                    </span>
                    <input
                      type="checkbox"
                      checked={includeReviewQr}
                      onChange={(e) => setIncludeReviewQr(e.target.checked)}
                      className="h-4 w-4 accent-orange-500 cursor-pointer"
                    />
                  </label>

                  {includeReviewQr && (
                    <Input
                      type="text"
                      aria-label="Customer review QR prompt"
                      value={reviewPrompt}
                      onChange={(e) => setReviewPrompt(e.target.value)}
                      placeholder={DEFAULT_REVIEW_PROMPT}
                      className="h-8 text-[11px]"
                    />
                  )}
                </div>

                {sentRecord && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-start gap-2.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                        Receipt sent via {sentRecord.channel}
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                        To {sentRecord.phone} · {format(new Date(sentRecord.sentAt), 'HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-neutral-800">
                  <Button
                    type="submit"
                    className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white gap-2 text-xs font-semibold"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Receipt via {channel}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handlePrint()}
                      disabled={isPrinting}
                      className="h-9 gap-1.5 text-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      {isPrinting ? 'Preparing...' : 'Print Receipt'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyText}
                      className="h-9 gap-1.5 text-xs"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Text
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
};
