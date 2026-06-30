import { Router } from 'express';
import { taskController } from '../controllers';

const router: Router = Router();

router.get('/stats', taskController.getStats);
router.get('/chain/:onChainId', taskController.getTaskByChainId);
router.get('/:id', taskController.getTaskById);
router.get('/', taskController.listTasks);
router.post('/', taskController.createTask);
router.patch('/:id', taskController.updateTaskMetadata);
router.post('/:id/applications', taskController.applyToTask);
router.get('/:id/applications', taskController.listApplications);
router.post('/:id/comments', taskController.addComment);

export default router;
