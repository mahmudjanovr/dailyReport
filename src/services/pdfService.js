import PDFDocument from 'pdfkit';
import { resolvePdfFonts, sanitizePdfText } from '../utils/fontLoader.js';

export class PdfService {
  /**
   * Generates a streamlined, minimalistic receipt PDF from report data.
   *
   * Layout:
   * 1. Top: "Daily Report" — large, bold, centered.
   * 2. Beneath: Operator name (left) and total count (right) in one row:
   *    e.g. "Rahmatillo         Jami: 25 ta"
   * 3. Beneath: Daily results by category (only categories where count > 0):
   *    Category name (left), count (right) e.g. "5 ta".
   *
   * @param {object} report - Hydrated report object with entries and totalCount
   * @returns {Promise<Buffer>}
   */
  static async generateReportPdf(report) {
    if (!report) {
      throw new Error('Report data is required for PDF generation');
    }

    const fontConfig = resolvePdfFonts();
    const isUnicode = fontConfig.hasUnicodeFont;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `Daily Report - ${report.operatorName || 'Operator'}`,
          Author: report.operatorName || 'Operator',
          Subject: 'Daily Report',
          Creator: 'Daily Report',
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Register fonts
      if (isUnicode) {
        doc.registerFont('AppFont', fontConfig.regular);
        doc.registerFont('AppFont-Bold', fontConfig.bold);
      } else {
        doc.registerFont('AppFont', 'Helvetica');
        doc.registerFont('AppFont-Bold', 'Helvetica-Bold');
      }
      doc.font('AppFont');

      const fontRegular = 'AppFont';
      const fontBold = 'AppFont-Bold';
      const s = (txt) => sanitizePdfText(txt, isUnicode);

      // Page geometry (A4 portrait: 595.28 x 841.89 pt)
      const pageWidth = 595.28;
      const cardWidth = 460;
      const cardX = (pageWidth - cardWidth) / 2;
      const padX = 36;
      const contentWidth = cardWidth - padX * 2;
      const contentX = cardX + padX;

      const cardY = 55;
      const padY = 32;

      // Extract dynamic report values
      const operatorName = (report.operatorName || 'Operator').trim();

      // Only include categories where count > 0
      const activeEntries = (report.entries || []).filter((item) => (Number(item.count) || 0) > 0);

      // Calculate dynamic total
      const total = activeEntries.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

      // Dynamic row heights to ensure text never overflows or overlaps
      const defaultRowHeight = 32;
      const calculatedRows = activeEntries.map((item) => {
        const catLabel = item.category_label || item.label || item.category_key || '';
        const count = Number(item.count) || 0;
        const countStr = `${count} ta`;

        // Check if label needs multiple lines
        doc.font(fontRegular).fontSize(12.5);
        const labelHeight = doc.heightOfString(s(catLabel), { width: contentWidth - 90 });
        const rowH = Math.max(defaultRowHeight, labelHeight + 14);

        return {
          label: catLabel,
          countStr,
          count,
          rowHeight: rowH,
        };
      });

      const rowsTotalHeight = calculatedRows.length > 0
        ? calculatedRows.reduce((sum, r) => sum + r.rowHeight, 0)
        : 36;

      // Precalculate card height:
      // padY(32) + Title(32) + gap(10) + div1(1) + gap(14) + operator/total(22) + gap(14) + div2(1.5) + gap(14) + rows + padBottom(28)
      const cardHeight = padY + 32 + 10 + 1 + 14 + 22 + 14 + 1.5 + 14 + rowsTotalHeight + 28;

      // Draw receipt card background and border
      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 10)
        .lineWidth(1)
        .fillAndStroke('#ffffff', '#e2e8f0');

      let curY = cardY + padY;

      // 1. Daily Report — large, clear, centered
      doc.font(fontBold).fontSize(24).fillColor('#0f172a');
      doc.text(s('Daily Report'), contentX, curY, { width: contentWidth, align: 'center' });
      curY += 32;

      // Divider 1
      curY += 10;
      doc.moveTo(contentX, curY).lineTo(contentX + contentWidth, curY).lineWidth(1).strokeColor('#e2e8f0').stroke();
      curY += 14;

      // 2. Operator name & Total result in one row
      // Example: Rahmatillo         Jami: 25 ta
      const totalColWidth = 130;
      const opColWidth = contentWidth - totalColWidth;
      doc.font(fontBold).fontSize(14).fillColor('#1e293b');
      doc.text(s(operatorName), contentX, curY, { width: opColWidth, align: 'left' });
      doc.text(s(`Jami: ${total} ta`), contentX + opColWidth, curY, { width: totalColWidth, align: 'right' });
      curY += 22;

      // Divider 2 (separator for category items)
      curY += 14;
      doc.moveTo(contentX, curY).lineTo(contentX + contentWidth, curY).lineWidth(1.5).strokeColor('#cbd5e1').stroke();
      curY += 14;

      // 3. Category daily results
      if (calculatedRows.length === 0) {
        doc.font(fontRegular).fontSize(12).fillColor('#94a3b8');
        doc.text(s('Natijalar mavjud emas'), contentX, curY + 8, { width: contentWidth, align: 'center' });
      } else {
        calculatedRows.forEach((row, index) => {
          const rowY = curY;

          // Category name (left)
          doc.font(fontRegular).fontSize(12.5).fillColor('#334155');
          doc.text(s(row.label), contentX, rowY + 7, { width: contentWidth - 90, align: 'left' });

          // Count (right)
          doc.font(fontBold).fontSize(12.5).fillColor('#0f172a');
          doc.text(s(row.countStr), contentX + contentWidth - 90, rowY + 7, { width: 90, align: 'right' });

          // Row divider line (except last row)
          if (index < calculatedRows.length - 1) {
            doc.moveTo(contentX, rowY + row.rowHeight).lineTo(contentX + contentWidth, rowY + row.rowHeight).lineWidth(0.5).strokeColor('#f1f5f9').stroke();
          }

          curY += row.rowHeight;
        });
      }

      doc.end();
    });
  }

  /**
   * Generates a standard filename for the PDF download.
   * Format: Rahmatillo_YYYY-MM-DD.pdf
   *
   * @param {string} operatorName
   * @param {string} reportDate
   * @returns {string}
   */
  static getReportFilename(operatorName, reportDate) {
    const cleanOperator = (operatorName || 'Operator').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${cleanOperator}_${reportDate}.pdf`;
  }
}
