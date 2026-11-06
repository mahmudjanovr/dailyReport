import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { getDb, closeDb } from '../config/database.js';
import { config } from '../config/env.js';
import { getBusinessDate, getBusinessTime } from '../utils/date.js';

const SQLITE_HEADER_MAGIC = 'SQLite format 3\0';
const REQUIRED_TABLES = ['categories', 'daily_reports', 'report_entries', 'settings'];

export class BackupService {
  /**
   * Creates an online, non-blocking snapshot of the SQLite database.
   *
   * @param {import('better-sqlite3').Database} [db=getDb()]
   * @returns {Promise<{ buffer: Buffer, filename: string, sizeBytes: number }>}
   */
  static async exportBackup(db = getDb()) {
    const timestamp = `${getBusinessDate()}_${getBusinessTime().replace(/:/g, '')}`;
    const filename = `operator_daily_report_backup_${timestamp}.sqlite`;
    const tempDir = path.resolve(config.rootDir, 'storage', 'data');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempBackupPath = path.resolve(tempDir, `backup_${crypto.randomUUID()}.sqlite`);

    try {
      await db.backup(tempBackupPath);
      const buffer = fs.readFileSync(tempBackupPath);
      const sizeBytes = buffer.length;

      return {
        buffer,
        filename,
        sizeBytes,
      };
    } finally {
      if (fs.existsSync(tempBackupPath)) {
        try {
          fs.unlinkSync(tempBackupPath);
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Validates a backup buffer for SQLite integrity and required schema tables.
   *
   * @param {Buffer} buffer
   * @returns {{ valid: boolean, tables?: string[], categoriesCount?: number, reportsCount?: number, error?: string }}
   */
  static validateBackupBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 512) {
      return { valid: false, error: 'Fayl hajmi juda kichik yoki bo‘sh (Fayl buzilgan)' };
    }

    // Check 16-byte SQLite magic header
    const header = buffer.subarray(0, 16).toString('utf8');
    if (header !== SQLITE_HEADER_MAGIC) {
      return { valid: false, error: 'Fayl formati noto‘g‘ri. Haqiqiy SQLite 3 ma‘lumotlar bazasi emas.' };
    }

    // Write to a temporary file to test with better-sqlite3
    const tempDir = path.resolve(config.rootDir, 'storage', 'data');
    const tempFile = path.resolve(tempDir, `val_${crypto.randomUUID()}.sqlite`);

    try {
      fs.writeFileSync(tempFile, buffer);
      const testDb = new Database(tempFile, { readonly: true, fileMustExist: true });

      try {
        // Run integrity check
        const integrity = testDb.pragma('quick_check', { simple: true });
        if (integrity !== 'ok') {
          return { valid: false, error: `Ma‘lumotlar bazasida buzilish aniqlandi: ${integrity}` };
        }

        // Check required tables
        const tables = testDb
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
          .all()
          .map((r) => r.name);

        for (const reqTable of REQUIRED_TABLES) {
          if (!tables.includes(reqTable)) {
            return {
              valid: false,
              error: `Zarur jadval yetishmaydi: ${reqTable}. Ushbu nusxa ushbu tizimga mos emas.`,
            };
          }
        }

        const categoriesCount = testDb.prepare('SELECT COUNT(*) as count FROM categories').get().count;
        const reportsCount = testDb.prepare('SELECT COUNT(*) as count FROM daily_reports').get().count;

        return {
          valid: true,
          tables,
          categoriesCount,
          reportsCount,
        };
      } finally {
        testDb.close();
      }
    } catch (err) {
      return { valid: false, error: `Validatsiya xatosi: ${err.message}` };
    } finally {
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Safely restores database from uploaded buffer with pre-restore safety backup.
   *
   * @param {Buffer} buffer
   * @param {string} [customDestPath=null]
   * @returns {Promise<{ restored: boolean, tables: string[], categoriesCount: number, reportsCount: number }>}
   */
  static async restoreBackup(buffer, customDestPath = null) {
    const validation = BackupService.validateBackupBuffer(buffer);
    if (!validation.valid) {
      throw new Error(validation.error || 'Noto‘g‘ri zaxira fayli');
    }

    const currentDbPath = customDestPath || config.dbAbsolutePath;
    const safetyBackupPath = `${currentDbPath}.pre_restore_${Date.now()}.bak`;

    // 1. Create a safety backup of existing database before touching anything
    if (fs.existsSync(currentDbPath)) {
      try {
        fs.copyFileSync(currentDbPath, safetyBackupPath);
      } catch (err) {
        throw new Error(`Xavfsizlik zaxirasini yaratib bo‘lmadi: ${err.message}`);
      }
    }

    try {
      // 2. Close current connection if restoring default db
      if (!customDestPath) {
        closeDb();
      }

      // Clean up WAL and SHM files if present (safely catching file lock issues on Windows)
      const walPath = `${currentDbPath}-wal`;
      const shmPath = `${currentDbPath}-shm`;
      if (fs.existsSync(walPath)) {
        try { fs.unlinkSync(walPath); } catch { /* ignore */ }
      }
      if (fs.existsSync(shmPath)) {
        try { fs.unlinkSync(shmPath); } catch { /* ignore */ }
      }

      // 3. Write new database file
      fs.writeFileSync(currentDbPath, buffer);

      // 4. Test re-opening the database
      const checkDb = customDestPath ? new Database(customDestPath) : getDb();
      try {
        const check = checkDb.pragma('quick_check', { simple: true });
        if (check !== 'ok') {
          throw new Error(`Qayta tiklangan bazada xatolik: ${check}`);
        }
      } finally {
        if (customDestPath) {
          checkDb.close();
        }
      }

      // If successful, clean up safety backup
      if (fs.existsSync(safetyBackupPath)) {
        try {
          fs.unlinkSync(safetyBackupPath);
        } catch {
          // ignore
        }
      }

      return {
        restored: true,
        tables: validation.tables,
        categoriesCount: validation.categoriesCount,
        reportsCount: validation.reportsCount,
      };
    } catch (error) {
      console.error('💥 Restore failed, rolling back to pre-restore safety backup...', error);

      // Rollback to safety backup
      try {
        if (!customDestPath) {
          closeDb();
        }
        if (fs.existsSync(safetyBackupPath)) {
          fs.copyFileSync(safetyBackupPath, currentDbPath);
          fs.unlinkSync(safetyBackupPath);
        }
        if (!customDestPath) {
          getDb(); // Re-open original db
        }
      } catch (rbErr) {
        console.error('💥 Critical rollback error:', rbErr);
      }

      throw new Error(`Zaxirani tiklashda xatolik yuz berdi: ${error.message}`);
    }
  }
}
