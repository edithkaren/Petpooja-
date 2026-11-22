/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BillReview {
  billId: string;
  outletId: string;
  outletName: string;
  rating: number; // 1..5
  highlights: string[];
  comment?: string;
  customerName?: string;
  submittedAt: string;
}

const REVIEWS_STORAGE_KEY = 'petpooja-bill-reviews-v1';

export const REVIEW_HIGHLIGHT_TAGS = [
  'Great Taste',
  'Fast Service',
  'Friendly Staff',
  'Clean & Cozy',
  'Value for Money',
] as const;

export function getAllBillReviews(): Record<string, BillReview> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getBillReview(billId: string): BillReview | null {
  const all = getAllBillReviews();
  return all[billId] || null;
}

export function saveBillReview(review: BillReview): BillReview {
  const all = getAllBillReviews();
  const next = {
    ...all,
    [review.billId]: review,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
  return review;
}
