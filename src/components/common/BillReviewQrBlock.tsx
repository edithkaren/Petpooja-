/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { QrCode, Star } from 'lucide-react';

import { Bill } from '@/types';
import { generateQrDataUrl } from '@/lib/barcode-utils';
import {
  buildCustomerReviewUrl,
  DEFAULT_REVIEW_HEADING,
  DEFAULT_REVIEW_PROMPT,
} from '@/lib/receipt-utils';
import { getBillReview } from '@/lib/bill-reviews';
import { cn } from '@/lib/utils';

interface BillReviewQrBlockProps {
  bill: Bill;
  className?: string;
  onOpenReview?: () => void;
}

export const BillReviewQrBlock: React.FC<BillReviewQrBlockProps> = ({
  bill,
  className,
  onOpenReview,
}) => {
  const [qrUrl, setQrUrl] = React.useState('');
  const existingReview = React.useMemo(() => getBillReview(bill.id), [bill.id]);

  React.useEffect(() => {
    let active = true;
    generateQrDataUrl(buildCustomerReviewUrl(bill), 148)
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setQrUrl('');
      });
    return () => {
      active = false;
    };
  }, [bill]);

  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-orange-300 dark:border-orange-500/40 bg-orange-50/40 dark:bg-orange-500/5 p-3.5 flex items-center gap-3.5',
        className
      )}
    >
      <div className="shrink-0 rounded-lg bg-white p-1.5 border border-slate-200 dark:border-neutral-700">
        {qrUrl ? (
          <img
            src={qrUrl}
            alt="Customer review QR code"
            className="w-20 h-20 block"
          />
        ) : (
          <div className="w-20 h-20 flex items-center justify-center bg-slate-50 rounded">
            <QrCode className="w-6 h-6 text-slate-400" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
          {DEFAULT_REVIEW_HEADING}
        </p>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
          {DEFAULT_REVIEW_PROMPT}
        </p>

        {existingReview ? (
          <p className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 pt-0.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            Rated {existingReview.rating}/5 by guest
          </p>
        ) : (
          onOpenReview && (
            <button
              type="button"
              onClick={onOpenReview}
              className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer pt-0.5 block"
            >
              Open customer review form →
            </button>
          )
        )}
      </div>
    </div>
  );
};
