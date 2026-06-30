import { Router } from 'express';
import { upload } from '../lib';
import { chatController } from '../controllers';

const router: Router = Router({ mergeParams: true });

router.get('/', chatController.getMessages);
router.post('/', upload.single('file'), chatController.postMessage);

export default router;
