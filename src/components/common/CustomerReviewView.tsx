/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { CheckCircle2, Star, Store, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { OUTLETS } from '@/lib/mock-data';
import {
  BillReview,
  getBillReview,
  REVIEW_HIGHLIGHT_TAGS,
  saveBillReview,
} from '@/lib/bill-reviews';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CustomerReviewViewProps {
  billId: string;
  outletId?: string;
  shortRef?: string;
  customerName?: string;
  embedded?: boolean;
  onSubmitted?: (review: BillReview) => void;
  onExitStandalone?: () => void;
}

export const CustomerReviewView: React.FC<CustomerReviewViewProps> = ({
  billId,
  outletId,
  shortRef,
  customerName: initialCustomerName,
  embedded = false,
  onSubmitted,
  onExitStandalone,
}) => {
  const outlet = OUTLETS.find((o) => o.id === outletId);
  const outletName = outlet ? `${outlet.name} (${outlet.city})` : 'Petpooja Partner Outlet';
  const displayRef = shortRef || billId.split('-').pop()?.slice(-6) || billId.slice(-6);

  const [existing, setExisting] = React.useState<BillReview | null>(() => getBillReview(billId));
  const [rating, setRating] = React.useState<number>(existing?.rating || 5);
  const [hoverRating, setHoverRating] = React.useState<number>(0);
  const [selectedTags, setSelectedTags] = React.useState<string[]>(existing?.highlights || []);
  const [comment, setComment] = React.useState<string>(existing?.comment || '');
  const [guestName, setGuestName] = React.useState<string>(
    existing?.customerName || initialCustomerName || ''
  );

  React.useEffect(() => {
    const loaded = getBillReview(billId);
    setExisting(loaded);
    if (loaded) {
      setRating(loaded.rating);
      setSelectedTags(loaded.highlights);
      setComment(loaded.comment || '');
      setGuestName(loaded.customerName || initialCustomerName || '');
    }
  }, [billId, initialCustomerName]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveBillReview({
      billId,
      outletId: outletId || '',
      outletName,
      rating,
      highlights: selectedTags,
      comment: comment.trim() || undefined,
      customerName: guestName.trim() || undefined,
      submittedAt: new Date().toISOString(),
    });
    setExisting(saved);
    onSubmitted?.(saved);
    toast.success('Thank you! Your review has been recorded.');
  };

  const content = (
    <div className="space-y-4">
      {existing ? (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-5 text-center space-y-3">
          <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Thank you for choosing us today!
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              We appreciate your {existing.rating}-star feedback for Bill #{displayRef}.
            </p>
          </div>
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  'w-5 h-5',
                  star <= existing.rating
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-300 dark:text-neutral-700'
                )}
              />
            ))}
          </div>
          {existing.highlights.length > 0 && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {existing.highlights.join(' · ')}
            </p>
          )}
          {existing.comment && (
            <p className="text-xs italic text-slate-600 dark:text-slate-300">
              "{existing.comment}"
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExisting(null)}
            className="text-xs mt-2"
          >
            Update Review
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              How was your experience for Bill <span className="font-mono">#{displayRef}</span>?
            </p>
            <div className="flex items-center justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= (hoverRating || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    aria-label={`Rate ${star} stars`}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-110 cursor-pointer"
                  >
                    <Star
                      className={cn(
                        'w-7 h-7 transition-colors',
                        active
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-neutral-700'
                      )}
                    />
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] font-medium text-orange-600 dark:text-orange-400">
              {rating === 5
                ? 'Loved it! (5/5)'
                : rating === 4
                  ? 'Great visit (4/5)'
                  : rating === 3
                    ? 'Good (3/5)'
                    : rating === 2
                      ? 'Could be better (2/5)'
                      : 'Needs attention (1/5)'}
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 block">
              What stood out?
            </span>
            <div className="flex flex-wrap gap-1.5">
              {REVIEW_HIGHLIGHT_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer',
                      active
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 hover:border-orange-300'
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-guest-name" className="text-xs">
              Your Name (optional)
            </Label>
            <Input
              id="review-guest-name"
              type="text"
              placeholder="e.g. Aarav Sharma"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-comment" className="text-xs">
              Comments or Suggestions (optional)
            </Label>
            <textarea
              id="review-comment"
              rows={2}
              placeholder="Tell us about the food, coffee, or service..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold"
          >
            Submit Customer Review
          </Button>
        </form>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 shadow-lg">
        <CardHeader className="border-b border-slate-100 dark:border-neutral-800 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                  {outletName}
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Customer Dining Feedback · Bill #{displayRef}
                </p>
              </div>
            </div>
            {onExitStandalone && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onExitStandalone}
                className="text-xs gap-1 shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                POS
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-5">{content}</CardContent>
      </Card>
    </div>
  );
};
