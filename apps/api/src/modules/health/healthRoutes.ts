import { Router } from 'express';
import { HealthController } from './healthController.js';
import { healthRecoveryRateLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.get('/', HealthController.getHealth);
router.post('/restart', healthRecoveryRateLimiter, HealthController.restart);

export default router;
