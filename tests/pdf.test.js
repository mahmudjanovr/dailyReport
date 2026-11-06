import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PdfService } from '../src/services/pdfService.js';
import { INITIAL_CATEGORIES } from '../database/init.js';

describe('PDF Generation (PDFKit)', () => {
  it('should generate a valid A4 PDF document containing all 12 categories with Unicode text', async () => {
    const sampleEntries = INITIAL_CATEGORIES.map((cat, idx) => ({
      category_id: idx + 1,
      category_key: cat.key,
      category_label: cat.label,
      count: (idx + 1) * 5,
    }));

    const totalCount = sampleEntries.reduce((sum, item) => sum + item.count, 0);

    const sampleReport = {
      id: 101,
      operatorName: 'Rahmatillo',
      reportDate: '2026-11-06',
      status: 'submitted',
      notes: 'Barcha qo‘ng‘iroqlar muvaffaqiyatli yakunlandi. O‘zbekcha matn to‘g‘ri chiqishi tekshirildi.',
      totalCount,
      entries: sampleEntries,
    };

    const pdfBuffer = await PdfService.generateReportPdf(sampleReport);

    assert.ok(Buffer.isBuffer(pdfBuffer), 'Output must be a Buffer');
    assert.ok(pdfBuffer.length > 5000, `PDF buffer is too small: ${pdfBuffer.length} bytes`);

    // Verify PDF standard header %PDF-
    const header = pdfBuffer.subarray(0, 5).toString('utf8');
    assert.strictEqual(header, '%PDF-', 'PDF must begin with %PDF- magic header');

    // Verify PDF EOF marker %%EOF
    const trailer = pdfBuffer.subarray(pdfBuffer.length - 100).toString('utf8');
    assert.ok(trailer.includes('%%EOF'), 'PDF must end with %%EOF marker');
  });

  it('should only include categories with count > 0 and exclude zero-count categories', async () => {
    const mixedEntries = [
      { category_id: 1, category_key: 'ko_tarmadi', category_label: 'Ko‘tarmadi', count: 5 },
      { category_id: 2, category_key: 'rad_etish', category_label: 'Rad etish', count: 3 },
      { category_id: 3, category_key: 'keladi', category_label: 'Keladi', count: 7 },
      { category_id: 4, category_key: 'farzandi_yoq', category_label: 'Farzandi yo‘q', count: 2 },
      { category_id: 5, category_key: 'bolasi_kichkina', category_label: 'Bolasi kichkina', count: 0 },
      { category_id: 6, category_key: '11_yosh', category_label: '11 yosh', count: 0 },
      { category_id: 7, category_key: 'ochirilgan', category_label: 'O‘chirilgan', count: 0 },
    ];

    const report = {
      id: 105,
      operatorName: 'Rahmatillo',
      reportDate: '2026-11-06',
      entries: mixedEntries,
    };

    const pdfBuffer = await PdfService.generateReportPdf(report);
    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 5000);

    const header = pdfBuffer.subarray(0, 5).toString('utf8');
    assert.strictEqual(header, '%PDF-');
    const trailer = pdfBuffer.subarray(pdfBuffer.length - 100).toString('utf8');
    assert.ok(trailer.includes('%%EOF'));
  });

  it('should accurately calculate dynamic total sum matching category counts', async () => {
    const testEntries = [
      { category_id: 1, category_label: 'Ko‘tarmadi', count: 5 },
      { category_id: 2, category_label: 'Rad etish', count: 3 },
      { category_id: 3, category_label: 'Keladi', count: 7 },
      { category_id: 4, category_label: 'Farzandi yo‘q', count: 2 },
      { category_id: 5, category_label: 'Xizmat doirasidan tashqarida', count: 8 },
    ];

    const report = {
      operatorName: 'Rahmatillo',
      reportDate: '2026-11-06',
      totalCount: 25,
      entries: testEntries,
    };

    const pdfBuffer = await PdfService.generateReportPdf(report);
    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 5000);
    assert.strictEqual(pdfBuffer.subarray(0, 5).toString('utf8'), '%PDF-');
  });

  it('should strictly omit signatures, technical IDs, category codes, and footer notices', async () => {
    const report = {
      id: 9999,
      operatorName: 'Rahmatillo',
      reportDate: '2026-11-06',
      entries: [
        { category_id: 99, category_key: 'SECRET_CODE_KEY_12345', category_label: 'Keladi', count: 5 },
      ],
    };

    const pdfBuffer = await PdfService.generateReportPdf(report);
    const pdfRawString = pdfBuffer.toString('binary');

    // Ensure deprecated legacy sections are not present in PDF
    assert.ok(!pdfRawString.includes('Mas‘ul operator:'), 'Must not contain operator signature block');
    assert.ok(!pdfRawString.includes('Hisobot tekshiruvchisi'), 'Must not contain management signature block');
    assert.ok(!pdfRawString.includes('Rasmiy shaxsiy hisobot hujjati'), 'Must not contain legacy footer');
    assert.ok(!pdfRawString.includes('SECRET_CODE_KEY_12345'), 'Must not expose internal category keys');
    assert.ok(!pdfRawString.includes('ID: #9999'), 'Must not display technical report ID');
    assert.ok(!pdfRawString.includes('Ulush (%)'), 'Must not include share percentage table header');
  });

  it('should handle long category labels without clipping or overlapping elements', async () => {
    const longReport = {
      operatorName: 'Rahmatillo Abdurazzoqov (Bosh Operator)',
      reportDate: '2026-11-06',
      entries: [
        {
          category_label: 'Xizmat ko‘rsatish doirasidan tashqarida bo‘lgan abonentlar guruhi',
          count: 14,
        },
        {
          category_label: 'Mijoz boshqa kompaniya xizmatlaridan foydalanishni afzal ko‘rdi',
          count: 9,
        },
      ],
    };

    const pdfBuffer = await PdfService.generateReportPdf(longReport);
    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 5000);
    assert.strictEqual(pdfBuffer.subarray(0, 5).toString('utf8'), '%PDF-');
  });

  it('should generate proper filename format: Rahmatillo_YYYY-MM-DD.pdf', () => {
    const filename = PdfService.getReportFilename('Rahmatillo', '2026-11-06');
    assert.strictEqual(filename, 'Rahmatillo_2026-11-06.pdf');

    const sanitizedFilename = PdfService.getReportFilename("Rahmat'illo Test", '2026-11-06');
    assert.match(sanitizedFilename, /^[a-zA-Z0-9_-]+_2026-11-06\.pdf$/);
  });

  it('should handle zero-total empty report without throwing', async () => {
    const emptyReport = {
      id: 102,
      operatorName: 'Rahmatillo',
      reportDate: '2026-11-07',
      status: 'draft',
      notes: null,
      totalCount: 0,
      entries: INITIAL_CATEGORIES.map((cat, idx) => ({
        category_id: idx + 1,
        category_key: cat.key,
        category_label: cat.label,
        count: 0,
      })),
    };

    const pdfBuffer = await PdfService.generateReportPdf(emptyReport);
    assert.ok(pdfBuffer.length > 3000);
    assert.strictEqual(pdfBuffer.subarray(0, 5).toString('utf8'), '%PDF-');
  });
});
