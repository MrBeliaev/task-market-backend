import { Router } from 'express';
import { chainController } from '../controllers';

const router: Router = Router();

router.get('/', chainController.listPublicChains);

export default router;
