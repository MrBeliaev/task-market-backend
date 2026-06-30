import { Router } from 'express';
import { upload } from '../lib';
import { disputeController } from '../controllers';

const router: Router = Router({ mergeParams: true });

router.get('/', disputeController.getMessages);
router.post('/', upload.single('file'), disputeController.postMessage);

export default router;
