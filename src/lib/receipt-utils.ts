/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { format } from 'date-fns';
import { Bill, Outlet } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { buildCode128SvgString, generateQrDataUrl } from '@/lib/barcode-utils';

export const DEFAULT_THANK_YOU_MESSAGE = 'Thank you for choosing us today!';
export const DEFAULT_REVIEW_HEADING = 'Thank you for Visiting Us.';
export const DEFAULT_REVIEW_PROMPT = 'Scan this QR and review about your moments with us';

export type ReceiptPaperFormat = '80mm' | 'wide';

export interface ReceiptBuildOptions {
  bill: Bill;
  outlet?: Outlet;
  customerPhone?: string;
  thankYouMessage?: string;
  includeReviewQr?: boolean;
  reviewPrompt?: string;
  paperFormat?: ReceiptPaperFormat;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getBillShortRef(billId: string): string {
  return billId.split('-').pop()?.slice(-6) || billId.slice(-6);
}

export function getOrderBarcodeValue(bill: Bill): string {
  const shortRef = getBillShortRef(bill.id).toUpperCase();
  return `PP-${shortRef}`;
}

export function buildOrderDetailsQrPayload(bill: Bill, outlet?: Outlet): string {
  const shortRef = getBillShortRef(bill.id);
  const outletLabel = outlet ? `${outlet.name} (${outlet.city})` : bill.outletId;
  const dateLabel = format(new Date(bill.createdAt), 'dd MMM yyyy, HH:mm');
  const paymentModes = bill.payments.map((p) => p.mode).join(', ') || 'Cash';
  const itemsSummary = bill.items
    .map((item) => `${item.qty}x ${item.name} (${formatCurrency(item.lineTotal)})`)
    .join('; ');

  return [
    `ORDER RECEIPT #${shortRef}`,
    `Outlet: ${outletLabel}`,
    `Date: ${dateLabel}`,
    `Channel: ${bill.orderType}${bill.tableNo ? ` (Table ${bill.tableNo})` : ` (${bill.source})`}`,
    `Items: ${itemsSummary}`,
    `Total: INR ${bill.total.toFixed(2)} (${paymentModes})`,
    `Status: ${bill.status}`,
    `Ref: ${bill.id}`,
  ].join('\n');
}

export function buildCustomerReviewUrl(bill: Bill): string {
  const shortRef = getBillShortRef(bill.id);
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://petpooja-pos.local';
  const params = new URLSearchParams({
    review: bill.id,
    outlet: bill.outletId,
    ref: shortRef,
  });
  return `${origin}/?${params.toString()}`;
}

export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return raw.trim();
}

export function isValidPhoneNumber(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

export function buildReceiptText({
  bill,
  outlet,
  customerPhone,
  thankYouMessage = DEFAULT_THANK_YOU_MESSAGE,
  includeReviewQr = true,
}: ReceiptBuildOptions): string {
  const outletTitle = outlet ? `${outlet.name} (${outlet.city})` : 'Petpooja POS Outlet';
  const shortRef = getBillShortRef(bill.id);
  const dateLabel = format(new Date(bill.createdAt), 'dd MMM yyyy, hh:mm a');
  const paymentModes = bill.payments.map((p) => p.mode).join(', ') || 'Cash';
  const phoneDisplay = customerPhone ? normalizeIndianPhone(customerPhone) : bill.customerPhone;

  const lines: string[] = [
    outletTitle,
    `Bill #${shortRef} · ${dateLabel}`,
    `Order: ${bill.orderType}${bill.tableNo ? ` (Table ${bill.tableNo})` : ` (${bill.source})`}`,
  ];

  if (bill.customerName || phoneDisplay) {
    lines.push(
      `Customer: ${[bill.customerName, phoneDisplay].filter(Boolean).join(' · ')}`
    );
  }

  lines.push('--------------------------------');
  bill.items.forEach((item) => {
    lines.push(`${item.qty}x ${item.name} — ${formatCurrency(item.lineTotal)}`);
  });
  lines.push('--------------------------------');
  lines.push(`Subtotal: ${formatCurrency(bill.subtotal)}`);
  lines.push(`GST (5%): ${formatCurrency(bill.tax)}`);
  if (bill.discount > 0) {
    lines.push(`Discount: -${formatCurrency(bill.discount)}`);
  }
  lines.push(`Total Paid (${paymentModes}): ${formatCurrency(bill.total)}`);
  lines.push(`Order Barcode: ${getOrderBarcodeValue(bill)}`);
  lines.push('');
  lines.push(thankYouMessage.trim() || DEFAULT_THANK_YOU_MESSAGE);

  if (includeReviewQr) {
    lines.push(DEFAULT_REVIEW_HEADING);
    lines.push(`${DEFAULT_REVIEW_PROMPT}: ${buildCustomerReviewUrl(bill)}`);
  }

  return lines.join('\n');
}

export async function printThermalReceipt({
  bill,
  outlet,
  customerPhone,
  thankYouMessage = DEFAULT_THANK_YOU_MESSAGE,
  includeReviewQr = true,
  reviewPrompt = DEFAULT_REVIEW_PROMPT,
  paperFormat = '80mm',
}: ReceiptBuildOptions): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  const outletName = outlet?.name || 'Petpooja POS';
  const outletCity = outlet?.city || 'India';
  const shortRef = getBillShortRef(bill.id);
  const dateLabel = format(new Date(bill.createdAt), 'dd MMM yyyy, HH:mm:ss');
  const paymentModes = bill.payments.map((p) => p.mode).join(', ') || 'Cash';
  const phoneToPrint = customerPhone?.trim() || bill.customerPhone;
  const note = thankYouMessage.trim() || DEFAULT_THANK_YOU_MESSAGE;
  const barcodeValue = getOrderBarcodeValue(bill);
  const barcodeSvg = buildCode128SvgString(barcodeValue, 46);

  const [orderQrDataUrl, reviewQrDataUrl] = await Promise.all([
    generateQrDataUrl(buildOrderDetailsQrPayload(bill, outlet), 156),
    includeReviewQr
      ? generateQrDataUrl(buildCustomerReviewUrl(bill), 156)
      : Promise.resolve(''),
  ]);

  const itemRowsHtml = bill.items
    .map(
      (item) => `
      <tr>
        <td class="item-name">${escapeHtml(item.name)}</td>
        <td class="num">${item.qty}</td>
        <td class="num">${escapeHtml(formatCurrency(item.unitPrice))}</td>
        <td class="num">${escapeHtml(formatCurrency(item.lineTotal))}</td>
      </tr>`
    )
    .join('');

  const pageWidthPx = paperFormat === 'wide' ? '640px' : '380px';
  const pageRule = paperFormat === 'wide' ? 'A4 portrait' : '90mm auto';

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt #${escapeHtml(shortRef)}</title>
  <style>
    @page { size: ${pageRule}; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #0f172a;
      background: #ffffff;
      margin: 0 auto;
      padding: 18px 20px 24px;
      width: ${pageWidthPx};
      max-width: 100%;
      font-size: 13px;
      line-height: 1.5;
    }
    .center { text-align: center; }
    .title { font-size: 17px; font-weight: 700; margin: 0; }
    .sub { font-size: 12px; color: #475569; margin: 3px 0 0; }
    .divider { border-top: 1px dashed #94a3b8; margin: 12px 0; }
    .meta-grid { display: grid; grid-template-columns: ${paperFormat === 'wide' ? '1fr 1fr' : '1fr'}; gap: 4px 18px; }
    .meta { font-size: 12px; display: flex; justify-content: space-between; gap: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; border-bottom: 1px dashed #94a3b8; padding: 5px 0; font-weight: 700; }
    th.num, td.num { text-align: right; white-space: nowrap; padding-left: 8px; }
    td { padding: 6px 0; vertical-align: top; }
    td.item-name { padding-right: 8px; }
    .totals { font-size: 12px; }
    .total-row { display: flex; justify-content: space-between; margin: 4px 0; }
    .grand-total { font-size: 15px; font-weight: 700; border-top: 1px dashed #0f172a; padding-top: 8px; margin-top: 8px; }
    .thank-you { margin: 12px 0 4px; text-align: center; font-weight: 700; font-size: 13px; }
    .barcode-box { margin-top: 14px; text-align: center; padding: 8px 6px; border: 1px solid #e2e8f0; border-radius: 6px; }
    .barcode-label { font-size: 11px; letter-spacing: 0.14em; margin-top: 5px; font-weight: 600; color: #334155; }
    .qr-grid {
      margin-top: 14px;
      display: grid;
      grid-template-columns: ${includeReviewQr ? '1fr 1fr' : '1fr'};
      gap: 12px;
      align-items: start;
    }
    .qr-card {
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 10px 8px;
      text-align: center;
    }
    .qr-card img { display: block; margin: 0 auto 6px; width: 112px; height: 112px; }
    .qr-title { font-size: 11px; font-weight: 700; margin: 0 0 2px; color: #0f172a; }
    .qr-caption { font-size: 10px; color: #475569; margin: 0; line-height: 1.35; }
    .bill-id { margin-top: 10px; text-align: center; font-size: 10px; color: #64748b; }
  </style>
</head>
<body>
  <div class="center">
    <p class="title">${escapeHtml(outletName)}</p>
    <p class="sub">${escapeHtml(outletCity)} · Tax Invoice &amp; Order Receipt</p>
  </div>
  <div class="divider"></div>
  <div class="meta-grid">
    <div class="meta"><span>Bill No:</span><strong>#${escapeHtml(shortRef)}</strong></div>
    <div class="meta"><span>Date:</span><span>${escapeHtml(dateLabel)}</span></div>
    <div class="meta"><span>Channel:</span><span>${escapeHtml(bill.orderType)}${
      bill.tableNo ? ` (Table ${escapeHtml(bill.tableNo)})` : ` (${escapeHtml(bill.source)})`
    }</span></div>
    <div class="meta"><span>Status:</span><span>${escapeHtml(bill.status)}</span></div>
    ${
      bill.customerName
        ? `<div class="meta"><span>Guest:</span><span>${escapeHtml(bill.customerName)}</span></div>`
        : ''
    }
    ${
      phoneToPrint
        ? `<div class="meta"><span>Phone:</span><span>${escapeHtml(
            normalizeIndianPhone(phoneToPrint)
          )}</span></div>`
        : ''
    }
  </div>
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="num">Qty</th>
        <th class="num">Rate</th>
        <th class="num">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHtml}
    </tbody>
  </table>
  <div class="divider"></div>
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${escapeHtml(
      formatCurrency(bill.subtotal)
    )}</span></div>
    <div class="total-row"><span>GST (5%)</span><span>${escapeHtml(
      formatCurrency(bill.tax)
    )}</span></div>
    ${
      bill.discount > 0
        ? `<div class="total-row"><span>Discount</span><span>-${escapeHtml(
            formatCurrency(bill.discount)
          )}</span></div>`
        : ''
    }
    <div class="total-row"><span>Payment Mode</span><span>${escapeHtml(paymentModes)}</span></div>
    <div class="total-row grand-total"><span>NET TOTAL</span><span>${escapeHtml(
      formatCurrency(bill.total)
    )}</span></div>
  </div>
  <div class="divider"></div>
  <p class="thank-you">${escapeHtml(note)}</p>

  <div class="barcode-box">
    ${barcodeSvg}
    <div class="barcode-label">${escapeHtml(barcodeValue)}</div>
  </div>

  <div class="qr-grid">
    <div class="qr-card">
      <img src="${orderQrDataUrl}" alt="Order Details QR Code" />
      <p class="qr-title">Scan Order Details</p>
      <p class="qr-caption">Bill #${escapeHtml(shortRef)} · ${bill.items.length} item(s)</p>
    </div>
    ${
      includeReviewQr
        ? `<div class="qr-card">
      <img src="${reviewQrDataUrl}" alt="Customer Review QR Code" />
      <p class="qr-title">${escapeHtml(DEFAULT_REVIEW_HEADING)}</p>
      <p class="qr-caption">${escapeHtml(reviewPrompt.trim() || DEFAULT_REVIEW_PROMPT)}</p>
    </div>`
        : ''
    }
  </div>

  <p class="bill-id">Ref: ${escapeHtml(bill.id)}</p>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 400);
  };

  iframe.contentWindow.onafterprint = cleanup;
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(cleanup, 1500);
    }
  }, 150);

  return true;
}
