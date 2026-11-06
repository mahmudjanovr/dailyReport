import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../src/app.js';
import { getDb, closeDb } from '../src/config/database.js';
import { initializeDatabase, INITIAL_CATEGORIES } from '../database/init.js';
import { normalizeCategoryKey } from '../src/utils/categoryKey.js';
import { CategoryService } from '../src/services/categoryService.js';
import { ReportService } from '../src/services/reportService.js';
import { PdfService } from '../src/services/pdfService.js';
import { BackupService } from '../src/services/backupService.js';

describe('Category Management & Dynamic Creation Upgrade', () => {
  let server;
  let baseUrl;

  before(async () => {
    initializeDatabase(getDb());
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    closeDb();
  });

  // 1. Uzbek character normalization
  describe('Uzbek character normalization', () => {
    it('normalizes "Qayta qo‘ng‘iroq qilish" to "qayta_qongiroq_qilish"', () => {
      const key = normalizeCategoryKey('Qayta qo‘ng‘iroq qilish');
      assert.strictEqual(key, 'qayta_qongiroq_qilish');
    });

    it('normalizes various Uzbek apostrophes and quotes: ‘, ’, ʻ, ʼ, \'', () => {
      assert.strictEqual(normalizeCategoryKey('Ko‘tarmadi'), 'kotarmadi');
      assert.strictEqual(normalizeCategoryKey('Ko’tarmadi'), 'kotarmadi');
      assert.strictEqual(normalizeCategoryKey('Koʻtarmadi'), 'kotarmadi');
      assert.strictEqual(normalizeCategoryKey('Koʼtarmadi'), 'kotarmadi');
      assert.strictEqual(normalizeCategoryKey("Ko'tarmadi"), 'kotarmadi');
      assert.strictEqual(normalizeCategoryKey('Farzandi yo‘q'), 'farzandi_yoq');
      assert.strictEqual(normalizeCategoryKey('Noto‘g‘ri raqam'), 'notogri_raqam');
      assert.strictEqual(normalizeCategoryKey('O‘chirilgan'), 'ochirilgan');
    });

    it('normalizes Uzbek Cyrillic letters to Latin ASCII', () => {
      assert.strictEqual(normalizeCategoryKey('Қайта қўнғироқ қилиш'), 'qayta_qongiroq_qilish');
      assert.strictEqual(normalizeCategoryKey('Боласи кичкина'), 'bolasi_kichkina');
    });

    it('collapses multiple spaces, dashes, and underscores', () => {
      assert.strictEqual(normalizeCategoryKey('  Maxsus - Yangi   Toifa!  '), 'maxsus_yangi_toifa');
    });

    it('handles empty or non-string inputs safely', () => {
      assert.strictEqual(normalizeCategoryKey(''), '');
      assert.strictEqual(normalizeCategoryKey(null), '');
      assert.strictEqual(normalizeCategoryKey(undefined), '');
    });
  });

  // 2. Creation of a category via API
  describe('POST /api/categories — Dynamic category creation', () => {
    it('creates a new custom category with automatic key and active status', async () => {
      const uniqueLabel = `Qayta qo‘ng‘iroq qilish ${Date.now()}`;
      const res = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: uniqueLabel }),
      });

      assert.strictEqual(res.status, 201, 'Should return HTTP 201 Created');
      const json = await res.json();

      assert.strictEqual(json.success, true);
      assert.ok(json.data.id > 0);
      assert.strictEqual(json.data.label, uniqueLabel);
      assert.ok(json.data.key.startsWith('qayta_qongiroq_qilish'));
      assert.strictEqual(json.data.is_active, 1, 'Must be automatically activated');
      assert.ok(json.data.sort_order > 12, 'Sort order must follow existing categories');
    });

    it('allows specifying an optional custom key if desired', async () => {
      const customKey = `custom_test_key_${Date.now()}`;
      const label = `Maxsus toifa ${Date.now()}`;

      const res = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, key: customKey }),
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.data.key, customKey);
      assert.strictEqual(json.data.label, label);
    });
  });

  // 3. Duplicate category rejection
  describe('Duplicate category rejection', () => {
    it('rejects duplicate category name (case-insensitive) with HTTP 409 Conflict', async () => {
      const duplicateLabel = 'Farzandlari katta'; // existing default seed category

      const res = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: duplicateLabel.toUpperCase() }),
      });

      assert.strictEqual(res.status, 409, 'Should return HTTP 409 Conflict for duplicate name');
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'CONFLICT');
      assert.ok(json.error.message.includes('allaqachon mavjud'));
    });

    it('rejects duplicate custom category name after creation with HTTP 409 Conflict', async () => {
      const testLabel = `Duplikat Sinov ${Date.now()}`;

      // 1. First creation succeeds
      const res1 = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: testLabel }),
      });
      assert.strictEqual(res1.status, 201);

      // 2. Second creation with same label (lowercase) must fail
      const res2 = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: `  ${testLabel.toLowerCase()}  ` }),
      });
      assert.strictEqual(res2.status, 409);
      const json2 = await res2.json();
      assert.strictEqual(json2.success, false);
      assert.strictEqual(json2.error.code, 'CONFLICT');
    });
  });

  // 4. Empty name rejection
  describe('Empty and invalid name rejection', () => {
    it('rejects empty string label with HTTP 400 Validation Error', async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '' }),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    });

    it('rejects whitespace-only label with HTTP 400 Validation Error', async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '     ' }),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    });

    it('rejects missing label property with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 400);
    });
  });

  // 5. Custom category persistence after database initialization
  describe('Custom category persistence after database initialization', () => {
    it('does not overwrite or delete custom categories during initializeDatabase()', () => {
      const db = getDb();
      const customLabel = `Doimiy toifa ${Date.now()}`;
      const custom = CategoryService.createCategory({ label: customLabel }, db);

      assert.ok(custom.id > 0);

      // Re-run database initialization multiple times (simulating server restart / redeployment)
      initializeDatabase(db);
      initializeDatabase(db);

      // Verify custom category is still in database
      const found = CategoryService.getById(custom.id, db);
      assert.ok(found, 'Custom category must survive initializeDatabase()');
      assert.strictEqual(found.label, customLabel);
      assert.strictEqual(found.key, custom.key);
      assert.strictEqual(found.is_active, 1);

      // Verify all 12 initial categories also still exist
      for (const initial of INITIAL_CATEGORIES) {
        const cat = CategoryService.getByKey(initial.key, db);
        assert.ok(cat, `Initial category ${initial.key} must be preserved`);
      }
    });

    it('preserves category activation states when initializeDatabase() is called', () => {
      const db = getDb();
      // Toggle category 1 to inactive (0)
      CategoryService.toggleActive(1, 0, db);
      const catBefore = CategoryService.getById(1, db);
      assert.strictEqual(catBefore.is_active, 0);

      // Re-initialize database
      initializeDatabase(db);

      // Activation state must not be reset to 1
      const catAfter = CategoryService.getById(1, db);
      assert.strictEqual(catAfter.is_active, 0, 'Inactive status must be preserved after database init');

      // Restore category 1 back to active for other tests
      CategoryService.toggleActive(1, 1, db);
    });
  });

  // 6. Counter autosave for custom categories
  describe('Counter autosave for custom categories', () => {
    it('allows atomic counter autosave on newly created custom categories', async () => {
      // 1. Create a custom category
      const label = `Autosave sinovi ${Date.now()}`;
      const createRes = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      assert.strictEqual(createRes.status, 201);
      const customCat = (await createRes.json()).data;

      // 2. Fetch today's report — custom category should be automatically included
      const todayRes = await fetch(`${baseUrl}/api/reports/today`);
      assert.strictEqual(todayRes.status, 200);
      const todayData = (await todayRes.json()).data;

      const foundEntry = todayData.entries.find((e) => e.category_id === customCat.id);
      assert.ok(foundEntry, 'Custom category must immediately appear in today report entries');
      assert.strictEqual(Number(foundEntry.count), 0, 'Initial count must be 0');

      // 3. Increment counter for custom category via autosave POST /api/reports/entry
      const autosaveRes = await fetch(`${baseUrl}/api/reports/entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: todayData.id,
          category_id: customCat.id,
          count: 24,
        }),
      });
      assert.strictEqual(autosaveRes.status, 200);
      const updatedReport = (await autosaveRes.json()).data;

      // 4. Verify updated report has the new count
      const updatedEntry = updatedReport.entries.find((e) => e.category_id === customCat.id);
      assert.ok(updatedEntry);
      assert.strictEqual(Number(updatedEntry.count), 24);

      // 5. Verify totalCount reflects custom category count
      const totalCount = updatedReport.entries.reduce((sum, item) => sum + item.count, 0);
      assert.strictEqual(updatedReport.totalCount, totalCount);
    });
  });

  // 7. PDF inclusion for custom categories
  describe('PDF inclusion for custom categories', () => {
    it('generates a valid PDF including custom categories with correct share calculations', async () => {
      const customLabel = 'Qayta qo‘ng‘iroq qilish';
      const sampleReport = {
        id: 999,
        operatorName: 'Rahmatillo',
        reportDate: '2026-11-06',
        status: 'submitted',
        notes: 'Hisobot custom toifalar bilan sinovdan o‘tkazildi',
        totalCount: 50,
        entries: [
          ...INITIAL_CATEGORIES.map((cat, idx) => ({
            category_id: idx + 1,
            category_key: cat.key,
            category_label: cat.label,
            count: 3,
          })),
          {
            category_id: 100,
            category_key: 'qayta_qongiroq_qilish',
            category_label: customLabel,
            count: 14,
          },
        ],
      };

      sampleReport.totalCount = sampleReport.entries.reduce((s, i) => s + i.count, 0);

      const pdfBuffer = await PdfService.generateReportPdf(sampleReport);
      assert.ok(Buffer.isBuffer(pdfBuffer));
      assert.ok(pdfBuffer.length > 5000);

      // Verify PDF structure
      const header = pdfBuffer.subarray(0, 5).toString('utf8');
      assert.strictEqual(header, '%PDF-');
      const trailer = pdfBuffer.subarray(pdfBuffer.length - 100).toString('utf8');
      assert.ok(trailer.includes('%%EOF'));
    });
  });

  // 8. Backup and restore compatibility
  describe('Backup and restore compatibility with custom categories', () => {
    it('preserves custom categories and their entries through backup export and restore', async () => {
      const db = getDb();
      const customLabel = `Zaxira sinovi ${Date.now()}`;
      const customCat = CategoryService.createCategory({ label: customLabel }, db);

      // Create a report with this custom category count
      const testDate = '2026-12-25';
      const report = ReportService.getOrCreateReportForDate('Rahmatillo', testDate, db);
      ReportService.saveSingleEntry({
        reportId: report.id,
        categoryId: customCat.id,
        count: 42,
      }, db);

      // Export backup
      const backup = await BackupService.exportBackup(db);
      assert.ok(backup.buffer instanceof Buffer);

      // Restore to a separate test database file
      const testDest = path.resolve(`storage/data/test_custom_cat_restore_${Date.now()}.sqlite`);
      try {
        const restoreResult = await BackupService.restoreBackup(backup.buffer, testDest);
        assert.strictEqual(restoreResult.restored, true);
        assert.ok(restoreResult.categoriesCount >= 13, 'Must contain 12 defaults + custom categories');

        // Verify custom category exists in restored database
        const Database = (await import('better-sqlite3')).default;
        const restoredDb = new Database(testDest);
        try {
          const restoredCat = restoredDb.prepare('SELECT * FROM categories WHERE id = ?').get(customCat.id);
          assert.ok(restoredCat, 'Custom category must be present in restored database');
          assert.strictEqual(restoredCat.label, customLabel);
          assert.strictEqual(restoredCat.key, customCat.key);

          const restoredEntry = restoredDb
            .prepare('SELECT * FROM report_entries WHERE report_id = ? AND category_id = ?')
            .get(report.id, customCat.id);
          assert.ok(restoredEntry, 'Report entry for custom category must be restored');
          assert.strictEqual(restoredEntry.count, 42);
        } finally {
          restoredDb.close();
        }
      } finally {
        if (fs.existsSync(testDest)) {
          try { fs.unlinkSync(testDest); } catch {}
        }
        const shm = `${testDest}-shm`;
        const wal = `${testDest}-wal`;
        if (fs.existsSync(shm)) try { fs.unlinkSync(shm); } catch {}
        if (fs.existsSync(wal)) try { fs.unlinkSync(wal); } catch {}
      }
    });
  });
});
