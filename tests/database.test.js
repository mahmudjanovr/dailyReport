import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDbConnection } from '../src/config/database.js';
import { initializeDatabase, INITIAL_CATEGORIES } from '../database/init.js';

describe('Database Schema & Constraints', () => {
  let db;

  before(() => {
    // Use an in-memory database with schema & seeding applied
    db = createDbConnection(':memory:');
    initializeDatabase(db);
  });

  after(() => {
    if (db && db.open) {
      db.close();
    }
  });

  it('should create all four required tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
      .all()
      .map((r) => r.name);

    assert.ok(tables.includes('categories'), 'categories table missing');
    assert.ok(tables.includes('daily_reports'), 'daily_reports table missing');
    assert.ok(tables.includes('report_entries'), 'report_entries table missing');
    assert.ok(tables.includes('settings'), 'settings table missing');
    assert.strictEqual(tables.length, 4, 'Should have exactly 4 application tables');
  });

  it('should seed all predefined categories with stable keys', () => {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
    assert.strictEqual(categories.length, INITIAL_CATEGORIES.length);
    assert.strictEqual(categories.length, 12, 'Should have exactly 12 categories');

    for (const expected of INITIAL_CATEGORIES) {
      const found = categories.find((c) => c.key === expected.key);
      assert.ok(found, `Category ${expected.key} not found`);
      assert.strictEqual(found.label, expected.label);
      assert.strictEqual(found.sort_order, expected.sort_order);
      assert.strictEqual(found.is_active, 1);
    }
  });

  it('should maintain exactly 12 categories without duplicates on multiple initializations', () => {
    initializeDatabase(db);
    initializeDatabase(db);
    const count = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    assert.strictEqual(count, 12, 'Should have exactly 12 categories after repeated init');

    const cat10 = db.prepare("SELECT * FROM categories WHERE key = 'notogri_raqam'").get();
    assert.ok(cat10, 'Category notogri_raqam must exist');
    assert.strictEqual(cat10.label, 'Noto‘g‘ri raqam');
    assert.strictEqual(cat10.sort_order, 10);

    const cat11 = db.prepare("SELECT * FROM categories WHERE key = 'raqam_egasi_boshqa'").get();
    assert.ok(cat11, 'Category raqam_egasi_boshqa must exist');
    assert.strictEqual(cat11.label, 'Raqam egasi boshqa');
    assert.strictEqual(cat11.sort_order, 11);

    const cat12 = db.prepare("SELECT * FROM categories WHERE key = 'farzandlari_katta'").get();
    assert.ok(cat12, 'Category farzandlari_katta must exist');
    assert.strictEqual(cat12.label, 'Farzandlari katta');
    assert.strictEqual(cat12.sort_order, 12);
  });

  it('should seed default settings including operator name and timezone', () => {
    const operatorSetting = db.prepare("SELECT value FROM settings WHERE key = 'default_operator_name'").get();
    assert.ok(operatorSetting, 'default_operator_name setting missing');
    assert.strictEqual(operatorSetting.value, 'Rahmatillo');

    const tzSetting = db.prepare("SELECT value FROM settings WHERE key = 'timezone'").get();
    assert.ok(tzSetting, 'timezone setting missing');
    assert.strictEqual(tzSetting.value, 'Asia/Tashkent');
  });

  it('should enforce non-negative integer constraint on category count', () => {
    // 1. Create a valid report header
    const insertReport = db.prepare(`
      INSERT INTO daily_reports (operator_name, report_date)
      VALUES (?, ?)
    `);
    const reportRes = insertReport.run('Rahmatillo', '2026-11-06');
    const reportId = reportRes.lastInsertRowid;

    const category = db.prepare("SELECT id FROM categories WHERE key = 'ko_tarmadi'").get();
    assert.ok(category, 'ko_tarmadi category should exist');

    // 2. Inserting valid count (>= 0) must succeed
    const insertEntry = db.prepare(`
      INSERT INTO report_entries (report_id, category_id, count)
      VALUES (?, ?, ?)
    `);
    assert.doesNotThrow(() => {
      insertEntry.run(reportId, category.id, 5);
    });

    // 3. Inserting negative count must fail with SQLITE_CONSTRAINT_CHECK
    const otherCategory = db.prepare("SELECT id FROM categories WHERE key = 'rad_etish'").get();
    assert.throws(
      () => {
        insertEntry.run(reportId, otherCategory.id, -1);
      },
      (err) => {
        assert.ok(
          err.code === 'SQLITE_CONSTRAINT_CHECK' || err.message.includes('CHECK constraint failed'),
          `Expected CHECK constraint error, got: ${err.message}`
        );
        return true;
      }
    );
  });

  it('should enforce unique constraint of one report per operator per calendar day', () => {
    const insertReport = db.prepare(`
      INSERT INTO daily_reports (operator_name, report_date)
      VALUES (?, ?)
    `);

    // First insertion succeeds
    insertReport.run('Rahmatillo', '2026-11-07');

    // Duplicate insertion for same operator and date must fail
    assert.throws(
      () => {
        insertReport.run('Rahmatillo', '2026-11-07');
      },
      (err) => {
        assert.ok(
          err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed'),
          `Expected UNIQUE constraint error, got: ${err.message}`
        );
        return true;
      }
    );
  });

  it('should enforce foreign key constraint on category_id', () => {
    const insertEntry = db.prepare(`
      INSERT INTO report_entries (report_id, category_id, count)
      VALUES (?, ?, ?)
    `);

    // Non-existent category_id 999999
    assert.throws(
      () => {
        insertEntry.run(1, 999999, 10);
      },
      (err) => {
        assert.ok(
          err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || err.message.includes('FOREIGN KEY constraint failed'),
          `Expected FOREIGN KEY constraint error, got: ${err.message}`
        );
        return true;
      }
    );
  });

  it('should cascade delete report_entries when daily_reports is deleted', () => {
    const insertReport = db.prepare(`
      INSERT INTO daily_reports (operator_name, report_date)
      VALUES (?, ?)
    `);
    const res = insertReport.run('Rahmatillo', '2026-11-08');
    const reportId = res.lastInsertRowid;

    const cat = db.prepare('SELECT id FROM categories LIMIT 1').get();
    db.prepare('INSERT INTO report_entries (report_id, category_id, count) VALUES (?, ?, ?)').run(reportId, cat.id, 12);

    const countBefore = db.prepare('SELECT COUNT(*) as count FROM report_entries WHERE report_id = ?').get(reportId).count;
    assert.strictEqual(countBefore, 1);

    // Delete the daily report
    db.prepare('DELETE FROM daily_reports WHERE id = ?').run(reportId);

    // Associated report_entries must be gone due to CASCADE
    const countAfter = db.prepare('SELECT COUNT(*) as count FROM report_entries WHERE report_id = ?').get(reportId).count;
    assert.strictEqual(countAfter, 0);
  });
});
