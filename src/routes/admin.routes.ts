import { Router } from 'express';
import { requireAdmin } from '../middleware';
import { adminController } from '../controllers';

const router: Router = Router();

router.get('/tasks', requireAdmin, adminController.listTasks);
router.get('/tasks/:id/dispute', requireAdmin, adminController.getTaskDispute);
router.get('/chains', requireAdmin, adminController.listChains);
router.post('/chains', requireAdmin, adminController.createChain);
router.patch('/chains/:chainId', requireAdmin, adminController.updateChain);

export default router;
