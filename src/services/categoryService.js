import { getDb } from '../config/database.js';
import { ConflictError, ValidationError } from '../utils/errors.js';
import { normalizeCategoryKey } from '../utils/categoryKey.js';

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

  /**
   * Creates a new category dynamically with automatic key generation,
   * duplicate protection, and active status.
   *
   * @param {object} params
   * @param {string} params.label - Human readable category name
   * @param {string} [params.key] - Optional custom key; auto-generated if omitted
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {object} The created category
   */
  static createCategory({ label, key = null }, db = getDb()) {
    const trimmedLabel = (label || '').trim();
    if (!trimmedLabel) {
      throw new ValidationError('Toifa nomi bo‘sh bo‘lishi mumkin emas');
    }

    return db.transaction(() => {
      // 1. Prevent duplicate category names (case-insensitive)
      const existingLabel = db
        .prepare('SELECT id, key, label FROM categories WHERE LOWER(TRIM(label)) = LOWER(TRIM(?))')
        .get(trimmedLabel);

      if (existingLabel) {
        throw new ConflictError(`Bu nomdagi toifa allaqachon mavjud: "${trimmedLabel}"`);
      }

      // 2. Generate unique, stable key automatically or validate custom key
      let candidateKey = (key || '').trim();
      if (!candidateKey) {
        const baseKey = normalizeCategoryKey(trimmedLabel) || `toifa_${Date.now()}`;
        candidateKey = baseKey;
        let counter = 2;
        while (db.prepare('SELECT id FROM categories WHERE key = ?').get(candidateKey)) {
          candidateKey = `${baseKey}_${counter}`;
          counter++;
        }
      } else {
        const existingKey = db.prepare('SELECT id, key FROM categories WHERE key = ?').get(candidateKey);
        if (existingKey) {
          throw new ConflictError(`Bu kalitli toifa allaqachon mavjud: "${candidateKey}"`);
        }
      }

      // 3. Determine next sort order: MAX(sort_order) + 1
      const maxOrderRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM categories').get();
      const sortOrder = (maxOrderRow?.max_order || 0) + 1;

      // 4. Insert category with is_active = 1
      const insertStmt = db.prepare(`
        INSERT INTO categories (key, label, sort_order, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      `);
      const info = insertStmt.run(candidateKey, trimmedLabel, sortOrder);
      const newCategoryId = info.lastInsertRowid;

      return CategoryService.getById(newCategoryId, db);
    })();
  }
}
