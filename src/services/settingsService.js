import fs from 'node:fs';
import { getDb } from '../config/database.js';
import { config } from '../config/env.js';

export class SettingsService {
  /**
   * Retrieves all configuration settings as an object map.
   *
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {Record<string, string>}
   */
  static getAllSettings(db = getDb()) {
    const stmt = db.prepare('SELECT key, value, description, updated_at FROM settings');
    const rows = stmt.all();
    const map = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  }

  /**
   * Retrieves a setting value by key.
   *
   * @param {string} key
   * @param {string|null} [defaultValue=null]
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {string|null}
   */
  static getSetting(key, defaultValue = null, db = getDb()) {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key);
    return row ? row.value : defaultValue;
  }

  /**
   * Convenience helper to get the active operator name.
   *
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {string}
   */
  static getOperatorName(db = getDb()) {
    return SettingsService.getSetting('default_operator_name', config.DEFAULT_OPERATOR_NAME, db);
  }

  /**
   * Updates the configured operator name.
   *
   * @param {string} operatorName
   * @param {import('better-sqlite3').Database} [db=getDb()]
   */
  static updateOperatorName(operatorName, db = getDb()) {
    SettingsService.setSetting(
      'default_operator_name',
      operatorName.trim(),
      'Default operator for daily reports',
      db
    );
    return operatorName.trim();
  }

  /**
   * Updates or inserts a configuration setting.
   *
   * @param {string} key
   * @param {string} value
   * @param {string|null} [description=null]
   * @param {import('better-sqlite3').Database} [db=getDb()]
   */
  static setSetting(key, value, description = null, db = getDb()) {
    const stmt = db.prepare(`
      INSERT INTO settings (key, value, description, updated_at)
      VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        description = coalesce(excluded.description, settings.description),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `);
    stmt.run(key, value, description);
  }

  /**
   * Returns system diagnostic numbers and statistics.
   *
   * @param {import('better-sqlite3').Database} [db=getDb()]
   */
  static getSystemStats(db = getDb()) {
    const reportsCount = db.prepare('SELECT COUNT(*) as count FROM daily_reports').get().count;
    const entriesCount = db.prepare('SELECT COUNT(*) as count FROM report_entries').get().count;
    const totalCalls = db.prepare('SELECT COALESCE(SUM(count), 0) as total FROM report_entries').get().total;
    const categoriesCount = db.prepare('SELECT COUNT(*) as count FROM categories WHERE is_active = 1 AND is_deleted = 0').get().count;

    let dbSizeBytes = 0;
    try {
      if (fs.existsSync(config.dbAbsolutePath)) {
        const stat = fs.statSync(config.dbAbsolutePath);
        dbSizeBytes = stat.size;
      }
    } catch {
      // ignore
    }

    return {
      reportsCount,
      entriesCount,
      totalCalls,
      categoriesCount,
      dbSizeBytes,
      dbPath: config.dbAbsolutePath,
      operatorName: SettingsService.getOperatorName(db),
      timezone: config.BUSINESS_TIMEZONE,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
