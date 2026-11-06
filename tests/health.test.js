import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { getDb, closeDb } from '../src/config/database.js';
import { initializeDatabase } from '../database/init.js';

describe('Health Check API (GET /api/health)', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Ensure DB is initialized
    initializeDatabase(getDb());

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        baseUrl = `http://localhost:${address.port}`;
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

  it('should return HTTP 200 with status ok and complete metadata', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.app, 'Operator Daily Report');
    assert.strictEqual(data.version, '1.0.0');
    assert.strictEqual(data.timezone, 'Asia/Tashkent');
    assert.strictEqual(data.defaultOperator, 'Rahmatillo');
    assert.match(data.businessDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(data.businessTime, /^\d{2}:\d{2}:\d{2}$/);

    // Database health
    assert.strictEqual(data.database.connected, true);
    assert.strictEqual(data.database.type, 'sqlite3');
    assert.ok(Array.isArray(data.database.tables));
    assert.ok(data.database.tables.includes('categories'));
    assert.ok(data.database.tables.includes('daily_reports'));
    assert.ok(data.database.tables.includes('report_entries'));
    assert.ok(data.database.tables.includes('settings'));
    assert.strictEqual(data.database.categoriesCount >= 11, true);
  });
});
