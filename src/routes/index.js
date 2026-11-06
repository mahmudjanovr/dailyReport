import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import reportRoutes from './reportRoutes.js';
import backupRoutes from './backupRoutes.js';

const apiRouter = Router();

apiRouter.use('/', healthRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/backup', backupRoutes);

export default apiRouter;
