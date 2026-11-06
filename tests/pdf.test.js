import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PdfService } from '../src/services/pdfService.js';
import { INITIAL_CATEGORIES } from '../database/init.js';

describe('PDF Generation (PDFKit)', () => {
  it('should generate a valid A4 PDF document containing all 11 categories with Unicode text', async () => {
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
  });
});
