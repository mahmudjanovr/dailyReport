import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { getDb, closeDb } from '../src/config/database.js';
import { initializeDatabase } from '../database/init.js';

describe('API Endpoints & Middleware', () => {
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

  it('GET / should serve the static HTML frontend', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Operator Daily Report'));
    assert.ok(text.includes('Rahmatillo'));
  });

  it('GET /api/categories should return all 11 categories', async () => {
    const res = await fetch(`${baseUrl}/api/categories`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.strictEqual(json.data.length, 11);

    const keys = json.data.map((c) => c.key);
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

  it('GET /api/settings should return configured settings', async () => {
    const res = await fetch(`${baseUrl}/api/settings`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.default_operator_name, 'Rahmatillo');
    assert.strictEqual(json.data.timezone, 'Asia/Tashkent');
  });

  it('POST /api/reports with invalid data should return 400 validation error', async () => {
    const res = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report_date: 'invalid-date-format',
        entries: [{ category_id: 1, count: -3 }],
      }),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(json.error.details));
  });

  it('GET /api/nonexistent-route should return 404 JSON error', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-route`);
    assert.strictEqual(res.status, 404);

    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'NOT_FOUND');
  });
});
