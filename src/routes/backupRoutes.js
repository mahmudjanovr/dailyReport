import express, { Router } from 'express';
import { BackupService } from '../services/backupService.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();

// GET /api/backup/download - Export & download SQLite database
router.get('/download', async (req, res, next) => {
  try {
    const backup = await BackupService.exportBackup();

    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    res.setHeader('Content-Length', backup.sizeBytes);
    res.end(backup.buffer);
  } catch (err) {
    next(err);
  }
});

// POST /api/backup/restore - Restore database from uploaded SQLite buffer
// Using express.raw to accept raw binary payload safely without external dependencies
router.post(
  '/restore',
  express.raw({
    type: ['application/octet-stream', 'application/x-sqlite3', 'application/vnd.sqlite3', '*/*'],
    limit: '50mb',
  }),
  async (req, res, next) => {
    try {
      const buffer = req.body;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new ValidationError('Tiklash uchun ma‘lumotlar bazasi fayli yuborilmadi');
      }

      const result = await BackupService.restoreBackup(buffer);

      res.json({
        success: true,
        message: 'Ma‘lumotlar bazasi zaxiradan muvaffaqiyatli qayta tiklandi',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
