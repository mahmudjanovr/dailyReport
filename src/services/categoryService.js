import { getDb } from '../config/database.js';

export class CategoryService {
  /**
   * Retrieves categories ordered by sort_order.
   *
   * @param {object} [options={}]
   * @param {boolean} [options.includeInactive=false]
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {Array<{ id: number, key: string, label: string, sort_order: number, is_active: number }>}
   */
  static getAllCategories({ includeInactive = false } = {}, db = getDb()) {
    const query = includeInactive
      ? `SELECT id, key, label, sort_order, is_active, created_at, updated_at
         FROM categories
         ORDER BY sort_order ASC, id ASC`
      : `SELECT id, key, label, sort_order, is_active, created_at, updated_at
         FROM categories
         WHERE is_active = 1
         ORDER BY sort_order ASC, id ASC`;

    return db.prepare(query).all();
  }

  /**
   * Finds a category by its stable key.
   *
   * @param {string} key
   * @param {import('better-sqlite3').Database} [db=getDb()]
   */
  static getByKey(key, db = getDb()) {
    const stmt = db.prepare(`
      SELECT id, key, label, sort_order, is_active, created_at, updated_at
      FROM categories
      WHERE key = ?
    `);
    return stmt.get(key) || null;
  }

  /**
   * Finds a category by its ID.
   *
   * @param {number} id
   * @param {import('better-sqlite3').Database} [db=getDb()]
   */
  static getById(id, db = getDb()) {
    const stmt = db.prepare(`
      SELECT id, key, label, sort_order, is_active, created_at, updated_at
      FROM categories
      WHERE id = ?
    `);
    return stmt.get(id) || null;
  }

  /**
   * Toggles category active status (visibility).
   *
   * @param {number} id
   * @param {boolean|number} isActive
   * @param {import('better-sqlite3').Database} [db=getDb()]
   */
  static toggleActive(id, isActive, db = getDb()) {
    const numericActive = isActive ? 1 : 0;
    const stmt = db.prepare(`
      UPDATE categories
      SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `);
    const info = stmt.run(numericActive, id);
    return info.changes > 0 ? CategoryService.getById(id, db) : null;
  }
}
