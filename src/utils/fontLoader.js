import fs from 'node:fs';
import path from 'node:path';

const CANDIDATE_FONT_PAIRS = [
  // Windows standard fonts
  {
    regular: 'C:/Windows/Fonts/arial.ttf',
    bold: 'C:/Windows/Fonts/arialbd.ttf',
  },
  {
    regular: 'C:/Windows/Fonts/segoeui.ttf',
    bold: 'C:/Windows/Fonts/segoeuib.ttf',
  },
  {
    regular: 'C:/Windows/Fonts/calibri.ttf',
    bold: 'C:/Windows/Fonts/calibrib.ttf',
  },
  // Linux standard TrueType fonts
  {
    regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  },
  {
    regular: '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    bold: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  },
  {
    regular: '/usr/share/fonts/TTF/DejaVuSans.ttf',
    bold: '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
  },
];

/**
 * Discovers available TrueType fonts for PDF rendering with full Unicode support.
 * Falls back to standard PDF Helvetica if no system TrueType font is found.
 *
 * @returns {{ hasUnicodeFont: boolean, regular: string, bold: string }}
 */
export function resolvePdfFonts() {
  for (const pair of CANDIDATE_FONT_PAIRS) {
    if (fs.existsSync(pair.regular) && fs.existsSync(pair.bold)) {
      return {
        hasUnicodeFont: true,
        regular: pair.regular,
        bold: pair.bold,
      };
    }
    if (fs.existsSync(pair.regular)) {
      return {
        hasUnicodeFont: true,
        regular: pair.regular,
        bold: pair.regular,
      };
    }
  }

  return {
    hasUnicodeFont: false,
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
  };
}

/**
 * Normalizes text to ensure safe rendering in standard PDF fonts if TrueType is unavailable.
 *
 * @param {string} text
 * @param {boolean} [unicodeSupported=true]
 * @returns {string}
 */
export function sanitizePdfText(text, unicodeSupported = true) {
  if (typeof text !== 'string') return '';
  if (unicodeSupported) return text;

  // Replace special Unicode apostrophes with standard single quotes for Helvetica compatibility
  return text
    .replace(/[\u2018\u2019\u02BB\u02BC`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');
}
