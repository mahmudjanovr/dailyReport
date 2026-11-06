import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { getDb, closeDb } from '../src/config/database.js';
import { initializeDatabase } from '../database/init.js';

describe('Reports API & Counter Autosave Endpoints', () => {
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

  it('GET /api/reports/today should return today report with all 11 categories', async () => {
    const res = await fetch(`${baseUrl}/api/reports/today`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data);
    assert.ok(json.data.id > 0);
    assert.ok(json.data.entries.length >= 11);

    // Verify all 11 categories are present
    const keys = json.data.entries.map((e) => e.category_key);
    assert.ok(keys.includes('ko_tarmadi'));
    assert.ok(keys.includes('rad_etish'));
    assert.ok(keys.includes('xizmat_doirasidan_tashqarida'));
    assert.ok(keys.includes('ochirilgan'));
    assert.ok(keys.includes('bolasi_kichkina'));
    assert.ok(keys.includes('11_yosh'));
    assert.ok(keys.includes('maslahatlashay'));
    assert.ok(keys.includes('keladi'));
    assert.ok(keys.includes('farzandi_yoq'));
    assert.ok(keys.includes('notogri_raqam'));
    assert.ok(keys.includes('raqam_egasi_boshqa'));
  });

  it('POST /api/reports/entry should atomically update a single category count', async () => {
    // 1. Get today's report
    const todayRes = await fetch(`${baseUrl}/api/reports/today`);
    const todayData = (await todayRes.json()).data;
    const reportId = todayData.id;
    const catId = todayData.entries[0].category_id;

    // 2. Update count to 17
    const updateRes = await fetch(`${baseUrl}/api/reports/entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report_id: reportId,
        category_id: catId,
        count: 17,
      }),
    });

    assert.strictEqual(updateRes.status, 200);
    const updateJson = await updateRes.json();
    assert.strictEqual(updateJson.success, true);

    const updatedEntry = updateJson.data.entries.find((e) => e.category_id === catId);
    assert.strictEqual(updatedEntry.count, 17);
    assert.ok(updateJson.data.totalCount >= 17);
  });

  it('POST /api/reports/entry should reject negative count with HTTP 400', async () => {
    const todayRes = await fetch(`${baseUrl}/api/reports/today`);
    const todayData = (await todayRes.json()).data;

    const res = await fetch(`${baseUrl}/api/reports/entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report_id: todayData.id,
        category_id: todayData.entries[0].category_id,
        count: -5,
      }),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  it('POST /api/reports/entry should reject non-integer count with HTTP 400', async () => {
    const todayRes = await fetch(`${baseUrl}/api/reports/today`);
    const todayData = (await todayRes.json()).data;

    const res = await fetch(`${baseUrl}/api/reports/entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report_id: todayData.id,
        category_id: todayData.entries[0].category_id,
        count: 4.5,
      }),
    });

    assert.strictEqual(res.status, 400);
  });

  it('GET /api/reports/today/pdf should stream valid downloadable PDF with A4 header', async () => {
    const res = await fetch(`${baseUrl}/api/reports/today/pdf`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/pdf');

    const disposition = res.headers.get('content-disposition');
    assert.ok(disposition.includes('attachment'));
    assert.ok(disposition.includes('.pdf'));

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    assert.strictEqual(buffer.subarray(0, 5).toString(), '%PDF-');
  });

  it('GET /api/reports/history should return historical reports with filtering', async () => {
    // Insert historical report for an earlier date
    const saveRes = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator_name: 'Rahmatillo',
        report_date: '2026-11-01',
        status: 'submitted',
        notes: 'Noyabr oyi boshidagi hisobot',
        entries: [
          { category_id: 1, count: 12 },
          { category_id: 2, count: 8 },
        ],
      }),
    });
    assert.strictEqual(saveRes.status, 201);

    // Query history
    const historyRes = await fetch(`${baseUrl}/api/reports/history?from=2026-11-01&to=2026-11-06`);
    assert.strictEqual(historyRes.status, 200);

    const historyJson = await historyRes.json();
    assert.strictEqual(historyJson.success, true);
    assert.ok(historyJson.data.length >= 2);

    // Query with search keyword
    const searchRes = await fetch(`${baseUrl}/api/reports/history?search=boshidagi`);
    const searchJson = await searchRes.json();
    assert.strictEqual(searchJson.success, true);
    assert.ok(searchJson.data.some((r) => r.notes?.includes('boshidagi')));
  });

  it('should display count 0 for new categories on older reports without entry records', async () => {
    // Create an older report with only category 1
    const db = getDb();
    const oldReportDate = '2026-10-15';
    db.prepare('DELETE FROM daily_reports WHERE report_date = ?').run(oldReportDate);

    const ins = db.prepare('INSERT INTO daily_reports (operator_name, report_date) VALUES (?, ?)');
    const reportId = ins.run('Rahmatillo', oldReportDate).lastInsertRowid;

    // Only insert 1 category into report_entries
    db.prepare('INSERT INTO report_entries (report_id, category_id, count) VALUES (?, ?, ?)')
      .run(reportId, 1, 10);

    const res = await fetch(`${baseUrl}/api/reports/${reportId}`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);

    const farzandiEntry = json.data.entries.find((e) => e.category_key === 'farzandi_yoq');
    assert.ok(farzandiEntry, 'farzandi_yoq must be present in hydrated older report');
    assert.strictEqual(farzandiEntry.count, 0, 'Older report must display 0 for unrecorded farzandi_yoq');

    const notogriEntry = json.data.entries.find((e) => e.category_key === 'notogri_raqam');
    assert.ok(notogriEntry, 'notogri_raqam must be present in hydrated older report');
    assert.strictEqual(notogriEntry.count, 0, 'Older report must display 0 for unrecorded notogri_raqam');

    const egasiEntry = json.data.entries.find((e) => e.category_key === 'raqam_egasi_boshqa');
    assert.ok(egasiEntry, 'raqam_egasi_boshqa must be present in hydrated older report');
    assert.strictEqual(egasiEntry.count, 0, 'Older report must display 0 for unrecorded raqam_egasi_boshqa');
  });

  it('should start any new calendar day with all 11 categories initialized to 0 and totalCount 0', async () => {
    const newDate = '2026-12-01';
    const db = getDb();
    db.prepare('DELETE FROM daily_reports WHERE report_date = ?').run(newDate);

    const res = await fetch(`${baseUrl}/api/reports/date/${newDate}`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.reportDate, newDate);
    assert.strictEqual(json.data.totalCount, 0, 'New day total count must be 0');
    assert.strictEqual(json.data.entries.length, 11, 'All 11 categories must be present');

    for (const entry of json.data.entries) {
      assert.strictEqual(entry.count, 0, `Category ${entry.category_key} must start at 0`);
    }
  });

  it('should keep saved counts when re-querying the same day without resetting', async () => {
    const testDate = '2026-12-01';
    const res1 = await fetch(`${baseUrl}/api/reports/date/${testDate}`);
    const report1 = (await res1.json()).data;

    const cat1 = report1.entries[0];
    const cat2 = report1.entries[1];

    // Update cat 1 to 15, cat 2 to 9
    await fetch(`${baseUrl}/api/reports/entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: report1.id, category_id: cat1.category_id, count: 15 }),
    });
    await fetch(`${baseUrl}/api/reports/entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: report1.id, category_id: cat2.category_id, count: 9 }),
    });

    // Re-query the same day (simulating page reload)
    const resReload = await fetch(`${baseUrl}/api/reports/date/${testDate}`);
    const reloaded = (await resReload.json()).data;

    assert.strictEqual(reloaded.id, report1.id);
    assert.strictEqual(reloaded.totalCount, 24, 'Total count must remain saved as 24');
    const entry1 = reloaded.entries.find((e) => e.category_id === cat1.category_id);
    const entry2 = reloaded.entries.find((e) => e.category_id === cat2.category_id);
    assert.strictEqual(entry1.count, 15, 'Category 1 must remain 15');
    assert.strictEqual(entry2.count, 9, 'Category 2 must remain 9');
  });

  it('should start a subsequent new day (e.g. 2026-12-02) with 0 counts without copying previous day counts', async () => {
    const nextDate = '2026-12-02';
    const db = getDb();
    db.prepare('DELETE FROM daily_reports WHERE report_date = ?').run(nextDate);

    const res = await fetch(`${baseUrl}/api/reports/date/${nextDate}`);
    const json = await res.json();

    assert.strictEqual(json.data.reportDate, nextDate);
    assert.strictEqual(json.data.totalCount, 0, 'Next day must start with 0 totalCount, not copy yesterday');
    for (const entry of json.data.entries) {
      assert.strictEqual(entry.count, 0, `Category ${entry.category_key} must be 0 on new day`);
    }

    // Verify previous day (2026-12-01) still has its original counts intact
    const prevRes = await fetch(`${baseUrl}/api/reports/date/2026-12-01`);
    const prevJson = await prevRes.json();
    assert.strictEqual(prevJson.data.totalCount, 24, 'Previous day total count must remain 24');
  });

  it('should generate a PDF for a new zero-count day with 0.0% shares and 0 total', async () => {
    const zeroDate = '2026-12-03';
    const db = getDb();
    db.prepare('DELETE FROM daily_reports WHERE report_date = ?').run(zeroDate);

    const res = await fetch(`${baseUrl}/api/reports/today/pdf?date=${zeroDate}`);
    assert.strictEqual(res.status, 200);

    const pdfBuffer = Buffer.from(await res.arrayBuffer());
    assert.strictEqual(pdfBuffer.subarray(0, 5).toString('utf8'), '%PDF-');
    assert.ok(pdfBuffer.length > 5000);
  });
});
