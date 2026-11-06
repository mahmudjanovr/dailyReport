import { Router } from 'express';
import { ReportService } from '../services/reportService.js';
import { SettingsService } from '../services/settingsService.js';
import { PdfService } from '../services/pdfService.js';
import {
  createReportSchema,
  saveSingleEntrySchema,
  historyQuerySchema,
} from '../validators/reportValidator.js';
import { getBusinessDate } from '../utils/date.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

const router = Router();

// GET /api/reports/today - Retrieve or create today's report for active operator
router.get('/today', (req, res, next) => {
  try {
    const operator = req.query.operator || SettingsService.getOperatorName();
    const date = req.query.date || getBusinessDate();
    const report = ReportService.getOrCreateReportForDate(operator, date);

    res.json({
      success: true,
      data: report,
      businessDate: getBusinessDate(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/today/pdf - Download today's report PDF
router.get('/today/pdf', async (req, res, next) => {
  try {
    const operator = req.query.operator || SettingsService.getOperatorName();
    const date = req.query.date || getBusinessDate();
    const report = ReportService.getOrCreateReportForDate(operator, date);

    const pdfBuffer = await PdfService.generateReportPdf(report);
    const filename = PdfService.getReportFilename(report.operatorName, report.reportDate);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/date/:date - Retrieve or initialize report for a specific calendar day
router.get('/date/:date', (req, res, next) => {
  try {
    const targetDate = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      throw new BadRequestError('Sana YYYY-MM-DD formatida bo‘lishi kerak');
    }
    const operator = req.query.operator || SettingsService.getOperatorName();
    const report = ReportService.getOrCreateReportForDate(operator, targetDate);

    res.json({
      success: true,
      data: report,
      businessDate: getBusinessDate(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/history - List historical reports with search & date filtering
router.get('/history', (req, res, next) => {
  try {
    const query = historyQuerySchema.parse(req.query);
    const operator = req.query.operator || null;

    const result = ReportService.listReports({
      operatorName: operator,
      fromDate: query.from,
      toDate: query.to,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });

    res.json({
      success: true,
      data: result.reports,
      totalCount: result.totalCount,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/entry - Fast atomic single category count autosave
router.post('/entry', (req, res, next) => {
  try {
    const validated = saveSingleEntrySchema.parse(req.body);

    const updatedReport = ReportService.saveSingleEntry({
      reportId: validated.report_id,
      categoryId: validated.category_id,
      count: validated.count,
      notes: validated.notes,
    });

    res.json({
      success: true,
      message: 'Miqdor saqlandi',
      data: updatedReport,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/:id - Retrieve specific report details
router.get('/:id', (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      throw new NotFoundError('Noto‘g‘ri hisobot identifikatori');
    }

    const report = ReportService.getReportById(id);
    if (!report) {
      throw new NotFoundError(`Hisobot #${id} topilmadi`);
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/:id/pdf - Generate & download historical PDF
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      throw new NotFoundError('Noto‘g‘ri hisobot identifikatori');
    }

    const report = ReportService.getReportById(id);
    if (!report) {
      throw new NotFoundError(`Hisobot #${id} topilmadi`);
    }

    const pdfBuffer = await PdfService.generateReportPdf(report);
    const filename = PdfService.getReportFilename(report.operatorName, report.reportDate);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// POST /api/reports - Full report create or update (bulk)
router.post('/', (req, res, next) => {
  try {
    const validated = createReportSchema.parse(req.body);

    const saved = ReportService.saveDailyReport({
      operatorName: validated.operator_name,
      reportDate: validated.report_date,
      status: validated.status || 'draft',
      notes: validated.notes,
      entries: validated.entries?.map((e) => ({
        categoryId: e.category_id,
        count: e.count,
        notes: e.notes,
      })),
    });

    res.status(201).json({
      success: true,
      message: 'Hisobot muvaffaqiyatli saqlandi',
      data: saved,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reports/:id - Delete a daily report
router.delete('/:id', (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      throw new NotFoundError('Noto‘g‘ri hisobot identifikatori');
    }

    const deleted = ReportService.deleteReport(id);
    if (!deleted) {
      throw new NotFoundError(`Hisobot #${id} topilmadi`);
    }

    res.json({
      success: true,
      message: 'Hisobot o‘chirildi',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
