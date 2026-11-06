import { Router } from 'express';
import { getDb, getDbHealth } from '../config/database.js';
import { config } from '../config/env.js';
import { SettingsService } from '../services/settingsService.js';
import { getBusinessDate, getBusinessTime, getUtcIsoString } from '../utils/date.js';

const router = Router();

router.get('/health', (req, res) => {
  const dbHealth = getDbHealth();

  let categoryCount = 0;
  let activeOperator = config.DEFAULT_OPERATOR_NAME;

  if (dbHealth.connected) {
    try {
      const db = getDb();
      const row = db.prepare('SELECT COUNT(*) as count FROM categories WHERE is_active = 1').get();
      categoryCount = row ? row.count : 0;
      activeOperator = SettingsService.getOperatorName(db);
    } catch {
      // ignore
    }
  }

  const isHealthy = dbHealth.connected && (dbHealth.tables?.length || 0) >= 4;

  const payload = {
    status: isHealthy ? 'ok' : 'degraded',
    app: 'Operator Daily Report',
    version: '1.0.0',
    timestamp: getUtcIsoString(),
    timezone: config.BUSINESS_TIMEZONE,
    businessDate: getBusinessDate(),
    businessTime: getBusinessTime(),
    defaultOperator: activeOperator,
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    environment: config.NODE_ENV,
    database: {
      connected: dbHealth.connected,
      type: 'sqlite3',
      tables: dbHealth.tables || [],
      categoriesCount: categoryCount,
    },
  };

  return res.status(isHealthy ? 200 : 503).json(payload);
});

export default router;
