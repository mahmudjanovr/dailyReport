import { getDb } from '../config/database.js';
import { ConflictError, ValidationError } from '../utils/errors.js';
import { normalizeCategoryKey } from '../utils/categoryKey.js';

export class CategoryService {
  /**
   * Retrieves categories ordered by sort_order.
   * By default, soft-deleted categories (is_deleted = 1) are never returned.
   *
   * @param {object} [options={}]
   * @param {boolean} [options.includeInactive=false]
   * @param {boolean} [options.includeDeleted=false]
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {Array<{ id: number, key: string, label: string, sort_order: number, is_active: number, is_deleted: number }>}
   */
  static getAllCategories({ includeInactive = false, includeDeleted = false } = {}, db = getDb()) {
    const conditions = [];

    if (!includeDeleted) {
      conditions.push('is_deleted = 0');
    }

    if (!includeInactive) {
      conditions.push('is_active = 1');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT id, key, label, sort_order, is_active, is_deleted, created_at, updated_at
      FROM categories
      ${whereClause}
      ORDER BY sort_order ASC, id ASC
    `;

    return db.prepare(query).all();
  }

  /**
   * Finds a category by its stable key.
   *
   * @param {string} key
   * @param {object} [options={}]
   * @param {boolean} [options.includeDeleted=false]
   * @param {import('better-sqlite3').Database} [db=getDb()]
   */
  static getByKey(key, { includeDeleted = false } = {}, db = getDb()) {
    const where = includeDeleted ? 'key = ?' : 'key = ? AND is_deleted = 0';
    const stmt = db.prepare(`
      SELECT id, key, label, sort_order, is_active, is_deleted, created_at, updated_at
      FROM categories
      WHERE ${where}
    `);
    return stmt.get(key) || null;
  }

  /**
   * Finds a category by its ID.
   *
   * @param {number} id
   * @param {object} [options={}]
   * @param {boolean} [options.includeDeleted=false]
   * @param {import('better-sqlite3').Database} [db=getDb()]
   */
  static getById(id, { includeDeleted = false } = {}, db = getDb()) {
    const where = includeDeleted ? 'id = ?' : 'id = ? AND is_deleted = 0';
    const stmt = db.prepare(`
      SELECT id, key, label, sort_order, is_active, is_deleted, created_at, updated_at
      FROM categories
      WHERE ${where}
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
      WHERE id = ? AND is_deleted = 0
    `);
    const info = stmt.run(numericActive, id);
    return info.changes > 0 ? CategoryService.getById(id, {}, db) : null;
  }

  /**
   * Safely deletes (soft-deletes) a category while preserving historic report records.
   * - Sets is_deleted = 1 and is_active = 0
   * - Cleans up unused zero-count entries in active drafts so it disappears immediately
   * - Preserves historical report entries where count > 0
   *
   * @param {number} id
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {object|null} The deleted category or null if not found
   */
  static deleteCategory(id, db = getDb()) {
    const category = CategoryService.getById(id, { includeDeleted: true }, db);
    if (!category || category.is_deleted === 1) {
      return null;
    }

    return db.transaction(() => {
      // 1. Mark category as soft-deleted and inactive
      const updateStmt = db.prepare(`
        UPDATE categories
        SET is_deleted = 1, is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `);
      updateStmt.run(id);

      // 2. Remove zero-count entries from draft/current reports so it disappears immediately from active views
      db.prepare('DELETE FROM report_entries WHERE category_id = ? AND count = 0').run(id);

      // 3. Return updated category state
      return {
        ...category,
        is_active: 0,
        is_deleted: 1,
      };
    })();
  }

  /**
   * Creates a new category dynamically with automatic key generation,
   * duplicate protection, and active status.
   * If a category with the same label was previously soft-deleted, it safely restores it.
   *
   * @param {object} params
   * @param {string} params.label - Human readable category name
   * @param {string} [params.key] - Optional custom key; auto-generated if omitted
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {object} The created or restored category
   */
  static createCategory({ label, key = null }, db = getDb()) {
    const trimmedLabel = (label || '').trim();
    if (!trimmedLabel) {
      throw new ValidationError('Toifa nomi bo‘sh bo‘lishi mumkin emas');
    }

    return db.transaction(() => {
      // 1. Check for existing category by name (case-insensitive)
      const existingLabel = db
        .prepare('SELECT id, key, label, is_deleted FROM categories WHERE LOWER(TRIM(label)) = LOWER(TRIM(?))')
        .get(trimmedLabel);

      if (existingLabel) {
        if (existingLabel.is_deleted === 0) {
          throw new ConflictError(`Bu nomdagi toifa allaqachon mavjud: "${trimmedLabel}"`);
        }

        // If previously soft-deleted, restore it as active
        const maxOrderRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM categories WHERE is_deleted = 0').get();
        const nextOrder = (maxOrderRow?.max_order || 0) + 1;

        db.prepare(`
          UPDATE categories
          SET is_deleted = 0, is_active = 1, sort_order = ?, label = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?
        `).run(nextOrder, trimmedLabel, existingLabel.id);

        return CategoryService.getById(existingLabel.id, {}, db);
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
        const existingKey = db.prepare('SELECT id, key, is_deleted FROM categories WHERE key = ?').get(candidateKey);
        if (existingKey) {
          if (existingKey.is_deleted === 0) {
            throw new ConflictError(`Bu kalitli toifa allaqachon mavjud: "${candidateKey}"`);
          }
          // Restore if key was deleted
          db.prepare(`
            UPDATE categories
            SET is_deleted = 0, is_active = 1, label = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
          `).run(trimmedLabel, existingKey.id);
          return CategoryService.getById(existingKey.id, {}, db);
        }
      }

      // 3. Determine next sort order: MAX(sort_order) + 1 among non-deleted categories
      const maxOrderRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM categories WHERE is_deleted = 0').get();
      const sortOrder = (maxOrderRow?.max_order || 0) + 1;

      // 4. Insert category with is_active = 1, is_deleted = 0
      const insertStmt = db.prepare(`
        INSERT INTO categories (key, label, sort_order, is_active, is_deleted, created_at, updated_at)
        VALUES (?, ?, ?, 1, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      `);
      const info = insertStmt.run(candidateKey, trimmedLabel, sortOrder);
      const newCategoryId = info.lastInsertRowid;

      return CategoryService.getById(newCategoryId, {}, db);
    })();
  }
}
