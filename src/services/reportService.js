import { getDb } from '../config/database.js';
import { config } from '../config/env.js';
import { getBusinessDate } from '../utils/date.js';
import { SettingsService } from './settingsService.js';

export class ReportService {
  /**
   * Builds the full structure for a report, joining existing entries with all categories.
   *
   * @param {object} reportRow
   * @param {import('better-sqlite3').Database} db
   * @returns {object}
   */
  static _hydrateReport(reportRow, db) {
    if (!reportRow) return null;

    // Fetch all categories (active or existing in this report)
    const entriesStmt = db.prepare(`
      SELECT
        c.id AS category_id,
        c.key AS category_key,
        c.label AS category_label,
        c.sort_order,
        c.is_active,
        COALESCE(re.id, 0) AS entry_id,
        COALESCE(re.count, 0) AS count,
        re.notes AS notes,
        re.updated_at
      FROM categories c
      LEFT JOIN report_entries re ON c.id = re.category_id AND re.report_id = ?
      WHERE c.is_active = 1 OR re.id IS NOT NULL
      ORDER BY c.sort_order ASC, c.id ASC
    `);

    const entries = entriesStmt.all(reportRow.id);
    const totalCount = entries.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

    return {
      id: reportRow.id,
      operatorName: reportRow.operator_name,
      reportDate: reportRow.report_date,
      status: reportRow.status,
      notes: reportRow.notes || '',
      createdAt: reportRow.created_at,
      updatedAt: reportRow.updated_at,
      totalCount,
      entries,
    };
  }

  /**
   * Retrieves a daily report by operator name and date.
   *
   * @param {string} [operatorName]
   * @param {string} reportDate - YYYY-MM-DD
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {object|null}
   */
  static getReportByDate(operatorName = null, reportDate, db = getDb()) {
    const operator = operatorName || SettingsService.getOperatorName(db);
    const reportRow = db
      .prepare('SELECT * FROM daily_reports WHERE operator_name = ? AND report_date = ?')
      .get(operator, reportDate);

    if (!reportRow) return null;
    return ReportService._hydrateReport(reportRow, db);
  }

  /**
   * Retrieves a report by its primary ID.
   *
   * @param {number} id
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {object|null}
   */
  static getReportById(id, db = getDb()) {
    const reportRow = db.prepare('SELECT * FROM daily_reports WHERE id = ?').get(id);
    if (!reportRow) return null;
    return ReportService._hydrateReport(reportRow, db);
  }

  /**
   * Retrieves or initializes a daily report for a specific calendar date.
   * - If a report already exists for this date, returns the saved report with its existing counts.
   * - If no report exists, initializes a brand new report with all active categories starting at count 0.
   * - Counts from previous days are never copied.
   *
   * @param {string|null} [operatorName=null]
   * @param {string|null} [reportDate=null] - YYYY-MM-DD (defaults to current business date in Asia/Tashkent)
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {object} Hydrated report
   */
  static getOrCreateReportForDate(operatorName = null, reportDate = null, db = getDb()) {
    const operator = operatorName || SettingsService.getOperatorName(db);
    const targetDate = reportDate || getBusinessDate();

    let report = ReportService.getReportByDate(operator, targetDate, db);
    if (report) return report;

    // Create a new report starting with 0 counts for all categories
    return db.transaction(() => {
      const insert = db.prepare(`
        INSERT INTO daily_reports (operator_name, report_date, status, updated_at)
        VALUES (?, ?, 'draft', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(operator_name, report_date) DO NOTHING
      `);
      insert.run(operator, targetDate);

      const createdRow = db
        .prepare('SELECT * FROM daily_reports WHERE operator_name = ? AND report_date = ?')
        .get(operator, targetDate);

      const categories = db.prepare('SELECT id FROM categories WHERE is_active = 1').all();
      const insertEntry = db.prepare(`
        INSERT INTO report_entries (report_id, category_id, count, updated_at)
        VALUES (?, ?, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(report_id, category_id) DO NOTHING
      `);

      for (const cat of categories) {
        insertEntry.run(createdRow.id, cat.id);
      }

      return ReportService._hydrateReport(createdRow, db);
    })();
  }

  /**
   * Gets today's report for the active operator, automatically creating it if it doesn't exist.
   *
   * @param {string} [operatorName]
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {object}
   */
  static getOrCreateTodayReport(operatorName = null, db = getDb()) {
    return ReportService.getOrCreateReportForDate(operatorName, getBusinessDate(), db);
  }

  /**
   * Updates or saves a single category entry count in an existing report.
   * Used for fast, atomic counter autosaving.
   *
   * @param {object} params
   * @param {number} params.reportId
   * @param {number} params.categoryId
   * @param {number} params.count - Must be non-negative integer
   * @param {string|null} [params.notes=null]
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {object} Updated report
   */
  static saveSingleEntry({ reportId, categoryId, count, notes = null }, db = getDb()) {
    if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
      throw new Error('Count must be a non-negative integer');
    }

    return db.transaction(() => {
      // 1. Ensure report exists
      const reportRow = db.prepare('SELECT * FROM daily_reports WHERE id = ?').get(reportId);
      if (!reportRow) {
        throw new Error(`Report with ID ${reportId} not found`);
      }

      // 2. Ensure category exists
      const categoryRow = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
      if (!categoryRow) {
        throw new Error(`Category with ID ${categoryId} not found`);
      }

      // 3. Upsert entry
      const stmt = db.prepare(`
        INSERT INTO report_entries (report_id, category_id, count, notes, updated_at)
        VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(report_id, category_id) DO UPDATE SET
          count = excluded.count,
          notes = coalesce(excluded.notes, report_entries.notes),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `);
      stmt.run(reportId, categoryId, count, notes);

      // 4. Touch report updated_at
      db.prepare("UPDATE daily_reports SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(reportId);

      return ReportService.getReportById(reportId, db);
    })();
  }

  /**
   * Saves or updates a daily report and all its entries within a single atomic transaction.
   *
   * @param {object} params
   * @param {string} [params.operatorName]
   * @param {string} params.reportDate - YYYY-MM-DD
   * @param {string} [params.status='draft']
   * @param {string|null} [params.notes=null]
   * @param {Array<{ categoryId: number, count: number, notes?: string|null }>} [params.entries=[]]
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {object} The saved report
   */
  static saveDailyReport(
    {
      operatorName = null,
      reportDate,
      status = 'draft',
      notes = null,
      entries = [],
    },
    db = getDb()
  ) {
    const operator = operatorName || SettingsService.getOperatorName(db);

    return db.transaction(() => {
      // Upsert report header
      const upsertReport = db.prepare(`
        INSERT INTO daily_reports (operator_name, report_date, status, notes, updated_at)
        VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(operator_name, report_date) DO UPDATE SET
          status = excluded.status,
          notes = coalesce(excluded.notes, daily_reports.notes),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `);

      upsertReport.run(operator, reportDate, status, notes);

      const reportRow = db
        .prepare('SELECT id FROM daily_reports WHERE operator_name = ? AND report_date = ?')
        .get(operator, reportDate);

      const reportId = reportRow.id;

      if (Array.isArray(entries) && entries.length > 0) {
        const upsertEntry = db.prepare(`
          INSERT INTO report_entries (report_id, category_id, count, notes, updated_at)
          VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          ON CONFLICT(report_id, category_id) DO UPDATE SET
            count = excluded.count,
            notes = coalesce(excluded.notes, report_entries.notes),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        `);

        for (const entry of entries) {
          upsertEntry.run(reportId, entry.categoryId, entry.count, entry.notes || null);
        }
      }

      return ReportService.getReportById(reportId, db);
    })();
  }

  /**
   * Retrieves historical reports with date filtering, search, and pagination.
   *
   * @param {object} [options={}]
   * @param {string} [options.operatorName]
   * @param {string} [options.fromDate] - YYYY-MM-DD
   * @param {string} [options.toDate] - YYYY-MM-DD
   * @param {string} [options.search]
   * @param {number} [options.limit=50]
   * @param {number} [options.offset=0]
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {{ reports: Array<object>, totalCount: number }}
   */
  static listReports(options = {}, db = getDb()) {
    const {
      operatorName = null,
      fromDate = null,
      toDate = null,
      search = null,
      limit = 50,
      offset = 0,
    } = options;

    const conditions = [];
    const params = [];

    if (operatorName) {
      conditions.push('dr.operator_name = ?');
      params.push(operatorName);
    }

    if (fromDate) {
      conditions.push('dr.report_date >= ?');
      params.push(fromDate);
    }

    if (toDate) {
      conditions.push('dr.report_date <= ?');
      params.push(toDate);
    }

    if (search && search.trim()) {
      conditions.push('(dr.notes LIKE ? OR dr.report_date LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as count FROM daily_reports dr ${whereClause}`;
    const totalCount = db.prepare(countSql).get(...params).count;

    const sql = `
      SELECT
        dr.id,
        dr.operator_name,
        dr.report_date,
        dr.status,
        dr.notes,
        dr.created_at,
        dr.updated_at,
        COALESCE(SUM(re.count), 0) AS total_count,
        COUNT(re.id) AS entries_count
      FROM daily_reports dr
      LEFT JOIN report_entries re ON dr.id = re.report_id
      ${whereClause}
      GROUP BY dr.id
      ORDER BY dr.report_date DESC
      LIMIT ? OFFSET ?
    `;

    const reports = db.prepare(sql).all(...params, limit, offset);

    return {
      reports,
      totalCount,
    };
  }

  /**
   * Deletes a report and cascades entries deletion.
   *
   * @param {number} id
   * @param {import('better-sqlite3').Database} [db=getDb()]
   */
  static deleteReport(id, db = getDb()) {
    const info = db.prepare('DELETE FROM daily_reports WHERE id = ?').run(id);
    return info.changes > 0;
  }
}
