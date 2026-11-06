import { Router } from 'express';
import { SettingsService } from '../services/settingsService.js';
import { updateOperatorSchema } from '../validators/settingsValidator.js';

const router = Router();

// GET /api/settings - Retrieve all settings
router.get('/', (req, res, next) => {
  try {
    const settings = SettingsService.getAllSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/settings/operator - Update active operator name
router.patch('/operator', (req, res, next) => {
  try {
    const validated = updateOperatorSchema.parse(req.body);
    const updated = SettingsService.updateOperatorName(validated.operator_name);

    res.json({
      success: true,
      message: 'Operator ismi yangilandi',
      data: {
        operatorName: updated,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/diagnostics - System metrics & stats
router.get('/diagnostics', (req, res, next) => {
  try {
    const stats = SettingsService.getSystemStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
