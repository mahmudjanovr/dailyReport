import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BackupService } from '../src/services/backupService.js';
import { getDb } from '../src/config/database.js';
import { initializeDatabase } from '../database/init.js';

describe('Backup and Restore Service', () => {
  it('should export a valid SQLite database snapshot buffer', async () => {
    initializeDatabase(getDb());

    const result = await BackupService.exportBackup();
    assert.ok(result.buffer instanceof Buffer);
    assert.ok(result.sizeBytes > 1000);
    assert.match(result.filename, /^operator_daily_report_backup_\d{4}-\d{2}-\d{2}_\d+\.sqlite$/);

    // Verify 16-byte SQLite magic header
    const header = result.buffer.subarray(0, 16).toString('utf8');
    assert.strictEqual(header, 'SQLite format 3\0');
  });

  it('should validate a correct SQLite backup', async () => {
    const backup = await BackupService.exportBackup();
    const validation = BackupService.validateBackupBuffer(backup.buffer);

    assert.strictEqual(validation.valid, true);
    assert.ok(validation.tables.includes('categories'));
    assert.ok(validation.tables.includes('daily_reports'));
    assert.ok(validation.tables.includes('report_entries'));
    assert.ok(validation.tables.includes('settings'));
    assert.strictEqual(validation.categoriesCount >= 11, true);
  });

  it('should reject corrupt or non-SQLite buffers', () => {
    const invalidBuffer = Buffer.from('This is not a SQLite database file at all');
    const validation = BackupService.validateBackupBuffer(invalidBuffer);

    assert.strictEqual(validation.valid, false);
    assert.ok(validation.error);
  });

  it('should reject empty or undersized buffers', () => {
    const tinyBuffer = Buffer.from('short');
    const validation = BackupService.validateBackupBuffer(tinyBuffer);

    assert.strictEqual(validation.valid, false);
    assert.ok(validation.error);
  });

  it('should safely restore a valid backup', async () => {
    const backup = await BackupService.exportBackup();
    const testDest = path.resolve('storage/data/test_restore_suite.sqlite');

    try {
      const restoreResult = await BackupService.restoreBackup(backup.buffer, testDest);
      assert.strictEqual(restoreResult.restored, true);
      assert.ok(restoreResult.categoriesCount >= 11);
    } finally {
      if (fs.existsSync(testDest)) {
        try { fs.unlinkSync(testDest); } catch {}
      }
    }
  });
});
