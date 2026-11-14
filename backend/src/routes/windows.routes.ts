import { Router } from 'express';
import { WindowsController } from '../controllers/windows.controller';

const router = Router();

router.post('/calculate', WindowsController.calculateWindows);

export default router;
