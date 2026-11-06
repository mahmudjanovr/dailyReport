import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { getDb, closeDb } from '../src/config/database.js';
import { initializeDatabase } from '../database/init.js';

describe('Settings & Category Management API', () => {
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

  it('PATCH /api/settings/operator should update operator name', async () => {
    const res = await fetch(`${baseUrl}/api/settings/operator`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operator_name: 'Rahmatillo' }),
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.operatorName, 'Rahmatillo');
  });

  it('PATCH /api/settings/operator should reject empty operator name', async () => {
    const res = await fetch(`${baseUrl}/api/settings/operator`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operator_name: '   ' }),
    });

    assert.strictEqual(res.status, 400);
  });

  it('PATCH /api/categories/:id/toggle should toggle category visibility without deleting records', async () => {
    const catRes = await fetch(`${baseUrl}/api/categories?all=true`);
    const categories = (await catRes.json()).data;
    const catToToggle = categories[0];

    const toggleRes = await fetch(`${baseUrl}/api/categories/${catToToggle.id}/toggle`, {
      method: 'PATCH',
    });
    assert.strictEqual(toggleRes.status, 200);
    const toggleJson = await toggleRes.json();
    assert.strictEqual(toggleJson.success, true);
    assert.strictEqual(toggleJson.data.is_active, catToToggle.is_active === 1 ? 0 : 1);

    // Toggle back to active
    await fetch(`${baseUrl}/api/categories/${catToToggle.id}/toggle`, {
      method: 'PATCH',
    });
  });

  it('GET /api/settings/diagnostics should return system metrics', async () => {
    const res = await fetch(`${baseUrl}/api/settings/diagnostics`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.categoriesCount >= 11);
    assert.ok(json.data.operatorName);
    assert.strictEqual(json.data.timezone, 'Asia/Tashkent');
  });
});
