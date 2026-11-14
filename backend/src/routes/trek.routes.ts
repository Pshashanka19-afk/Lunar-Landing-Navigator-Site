import { Router } from 'express';
import { MoonTrekController } from '../controllers/trek.controller';

const router = Router();

router.get('/layers', MoonTrekController.getLayers);
router.get('/layers/:layerId', MoonTrekController.getLayerDetails);
router.get('/capabilities/:layerId', MoonTrekController.getCapabilities);

export default router;

