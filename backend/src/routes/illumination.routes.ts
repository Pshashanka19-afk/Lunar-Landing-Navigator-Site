import { Router } from 'express';
import { IlluminationController } from '../controllers/illumination.controller';

const router = Router();

router.post('/instant', IlluminationController.getInstantIllumination);

export default router;
