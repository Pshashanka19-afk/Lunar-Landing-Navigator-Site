import { Router } from 'express';
import { GeometryController } from '../controllers/geometry.controller';

const router = Router();

router.post('/sun', GeometryController.getSunGeometry);
router.post('/earth', GeometryController.getEarthGeometry);
router.post('/sky', GeometryController.getSkyGeometry);

export default router;
