/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import QRCode from 'qrcode';

// ISO/IEC 15417 Code 128 bar/space module widths (values 0..106)
const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112', // 100-106 (104=Start B, 106=Stop)
];

export interface BarcodeLayout {
  value: string;
  width: number;
  height: number;
  bars: Array<{ x: number; width: number }>;
}

export function encodeCode128B(rawValue: string, barHeight = 42, moduleWidth = 1.6): BarcodeLayout {
  // Sanitize to printable ASCII 32..126 supported by Code 128 Set B
  const sanitized =
    rawValue
      .replace(/[^\x20-\x7E]/g, '')
      .slice(0, 28) || 'PP-ORDER';

  const codes: number[] = [104]; // Start Code B
  let checksum = 104;

  for (let i = 0; i < sanitized.length; i++) {
    const code = sanitized.charCodeAt(i) - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(106); // Stop pattern

  const quietModules = 8;
  let cursor = quietModules * moduleWidth;
  const bars: Array<{ x: number; width: number }> = [];

  for (const symbol of codes) {
    const pattern = CODE128_PATTERNS[symbol];
    if (!pattern) continue;
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]) * moduleWidth;
      if (i % 2 === 0) {
        bars.push({ x: Number(cursor.toFixed(2)), width: Number(w.toFixed(2)) });
      }
      cursor += w;
    }
  }

  const totalWidth = Number((cursor + quietModules * moduleWidth).toFixed(2));

  return {
    value: sanitized,
    width: totalWidth,
    height: barHeight,
    bars,
  };
}

export function buildCode128SvgString(rawValue: string, barHeight = 42): string {
  const layout = encodeCode128B(rawValue, barHeight, 1.5);
  const rects = layout.bars
    .map(
      (b) =>
        `<rect x="${b.x}" y="0" width="${b.width}" height="${layout.height}" fill="#0f172a" />`
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="100%" height="${layout.height}" role="img" aria-label="Order barcode ${layout.value}" style="display:block;max-width:280px;margin:0 auto;background:#ffffff;">${rects}</svg>`;
}

export async function generateQrDataUrl(payload: string, size = 160): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}
