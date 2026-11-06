import PDFDocument from 'pdfkit';
import { resolvePdfFonts, sanitizePdfText } from '../utils/fontLoader.js';
import { getBusinessDate, getBusinessDateTimeString, getBusinessTime } from '../utils/date.js';

export class PdfService {
  /**
   * Generates a PDF stream or buffer from report data.
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
          Title: `Operator Daily Report - ${report.operatorName} - ${report.reportDate}`,
          Author: report.operatorName,
          Subject: 'Operator Daily Performance Summary',
          Creator: 'Operator Daily Report v1.0',
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
        doc.font('AppFont');
      } else {
        doc.registerFont('AppFont', 'Helvetica');
        doc.registerFont('AppFont-Bold', 'Helvetica-Bold');
        doc.font('AppFont');
      }

      const fontRegular = 'AppFont';
      const fontBold = 'AppFont-Bold';

      const s = (txt) => sanitizePdfText(txt, isUnicode);

      // Colors
      const primaryColor = '#1e3a8a'; // Deep Navy Blue
      const secondaryColor = '#3b82f6'; // Bright Blue
      const textColor = '#1e293b'; // Slate 800
      const mutedColor = '#64748b'; // Slate 500
      const borderColor = '#cbd5e1'; // Slate 300
      const lightBg = '#f8fafc'; // Slate 50
      const highlightBg = '#eff6ff'; // Blue 50

      const pageWidth = 595.28;
      const contentWidth = pageWidth - 80; // 515.28 pt

      // 1. Header Banner
      doc.rect(40, 40, contentWidth, 54).fill(primaryColor);

      doc.fillColor('#ffffff').font(fontBold).fontSize(16);
      doc.text(s('OPERATOR KUNLIK HISOBOTI'), 55, 52, { width: 340 });

      doc.font(fontRegular).fontSize(8.5).fillColor('#93c5fd');
      doc.text(s('Operator Daily Performance Summary Report'), 55, 73);

      doc.font(fontBold).fontSize(12).fillColor('#ffffff');
      doc.text(s(report.reportDate), 400, 52, { align: 'right', width: 140 });

      doc.font(fontRegular).fontSize(8).fillColor('#bfdbfe');
      doc.text(s(`ID: #${report.id}`), 400, 71, { align: 'right', width: 140 });

      // 2. Metadata Cards Bar
      const metaY = 106;
      doc.rect(40, metaY, contentWidth, 52).fillAndStroke(lightBg, borderColor);

      // Operator Name
      doc.fillColor(mutedColor).font(fontRegular).fontSize(7.5).text(s('OPERATOR:'), 55, metaY + 10);
      doc.fillColor(textColor).font(fontBold).fontSize(11).text(s(report.operatorName), 55, metaY + 22);

      // Business Date
      doc.fillColor(mutedColor).font(fontRegular).fontSize(7.5).text(s('HISOBOT SANASI:'), 190, metaY + 10);
      doc.fillColor(textColor).font(fontBold).fontSize(11).text(s(report.reportDate), 190, metaY + 22);

      // Generation Timestamp
      const genTimeStr = `${getBusinessDate()} ${getBusinessTime()} (Asia/Tashkent)`;
      doc.fillColor(mutedColor).font(fontRegular).fontSize(7.5).text(s('YARATILGAN VAQTI:'), 325, metaY + 10);
      doc.fillColor(textColor).font(fontRegular).fontSize(9).text(s(genTimeStr), 325, metaY + 23);

      // Total Call Volume Badge
      doc.rect(455, metaY + 8, 90, 36).fillAndStroke(highlightBg, secondaryColor);
      doc.fillColor(secondaryColor).font(fontRegular).fontSize(7.5).text(s('JAMI NATIJA:'), 455, metaY + 12, { align: 'center', width: 90 });
      doc.fillColor(primaryColor).font(fontBold).fontSize(14).text(String(report.totalCount || 0), 455, metaY + 23, { align: 'center', width: 90 });

      // 3. Table Header
      const tableY = 175;
      const colNo = 40;
      const colName = 75;
      const colCode = 310;
      const colCount = 420;
      const colShare = 485;

      const wNo = 35;
      const wName = 235;
      const wCode = 110;
      const wCount = 65;
      const wShare = 70;

      doc.rect(40, tableY, contentWidth, 24).fill(primaryColor);

      doc.fillColor('#ffffff').font(fontBold).fontSize(8.5);
      doc.text(s('№'), colNo, tableY + 7, { width: wNo, align: 'center' });
      doc.text(s('Kategoriya Nomi (Category)'), colName + 5, tableY + 7, { width: wName });
      doc.text(s('Kodi (Key)'), colCode + 5, tableY + 7, { width: wCode });
      doc.text(s('Miqdori'), colCount, tableY + 7, { width: wCount - 5, align: 'right' });
      doc.text(s('Ulush (%)'), colShare, tableY + 7, { width: wShare - 10, align: 'right' });

      // 4. Table Rows
      let currentY = tableY + 24;
      const rowHeight = 26;
      const entries = report.entries || [];
      const total = report.totalCount || 0;

      entries.forEach((item, index) => {
        const isEven = index % 2 === 0;
        doc.rect(40, currentY, contentWidth, rowHeight).fill(isEven ? '#ffffff' : '#f8fafc');
        doc.rect(40, currentY, contentWidth, rowHeight).stroke(borderColor);

        // Sequence number
        doc.fillColor(mutedColor).font(fontRegular).fontSize(8.5);
        doc.text(String(index + 1), colNo, currentY + 8, { width: wNo, align: 'center' });

        // Category label
        doc.fillColor(textColor).font(fontBold).fontSize(9.5);
        doc.text(s(item.category_label || item.label || ''), colName + 5, currentY + 8, { width: wName });

        // Category key code
        doc.fillColor(mutedColor).font(fontRegular).fontSize(8);
        doc.text(s(item.category_key || item.key || ''), colCode + 5, currentY + 9, { width: wCode });

        // Count
        const count = Number(item.count) || 0;
        doc.fillColor(textColor).font(fontBold).fontSize(10);
        doc.text(String(count), colCount, currentY + 8, { width: wCount - 5, align: 'right' });

        // Share percentage
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0.0%';
        doc.fillColor(primaryColor).font(fontRegular).fontSize(8.5);
        doc.text(pct, colShare, currentY + 8, { width: wShare - 10, align: 'right' });

        currentY += rowHeight;
      });

      // 5. Total Summary Row
      doc.rect(40, currentY, contentWidth, 28).fillAndStroke(highlightBg, secondaryColor);
      doc.fillColor(primaryColor).font(fontBold).fontSize(10);
      doc.text(s('JAMI (TOTAL CALLS / RESULTS):'), colName + 5, currentY + 9, { width: 330 });

      doc.fillColor(primaryColor).font(fontBold).fontSize(12);
      doc.text(String(total), colCount, currentY + 8, { width: wCount - 5, align: 'right' });

      doc.fillColor(primaryColor).font(fontBold).fontSize(9.5);
      doc.text(total > 0 ? '100.0%' : '0.0%', colShare, currentY + 9, { width: wShare - 10, align: 'right' });

      currentY += 40;

      // 6. Signatures & Verification Area
      const sigY = Math.max(currentY + 20, 680);
      doc.rect(40, sigY, contentWidth, 68).stroke(borderColor);

      // Left: Operator Signature
      doc.fillColor(mutedColor).font(fontRegular).fontSize(8);
      doc.text(s('Mas‘ul operator:'), 55, sigY + 12);
      doc.fillColor(textColor).font(fontBold).fontSize(9.5);
      doc.text(s(report.operatorName), 55, sigY + 26);
      doc.text('Imzo: _________________________', 55, sigY + 46);

      // Right: Management / Verification
      doc.fillColor(mutedColor).font(fontRegular).fontSize(8);
      doc.text(s('Hisobot tekshiruvchisi / Rahbariyat:'), 320, sigY + 12);
      doc.fillColor(textColor).font(fontBold).fontSize(9.5);
      doc.text(s('Qabul qilindi / Tasdiqlandi'), 320, sigY + 26);
      doc.text('Imzo va muhr: _________________________', 320, sigY + 46);

      // 8. Footer (Page numbers across all pages)
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const footerY = 790;
        doc.moveTo(40, footerY).lineTo(pageWidth - 40, footerY).stroke(borderColor);

        doc.fillColor(mutedColor).font(fontRegular).fontSize(7.5);
        doc.text(
          s('Operator Daily Report • Rasmiy shaxsiy hisobot hujjati'),
          40,
          footerY + 8,
          { width: 300 }
        );

        doc.text(
          s(`Sahifa ${i + 1} / ${range.count}`),
          pageWidth - 140,
          footerY + 8,
          { width: 100, align: 'right' }
        );
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
