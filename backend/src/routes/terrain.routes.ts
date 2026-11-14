import { Router } from 'express';
import { TerrainController } from '../controllers/terrain.controller';

const router = Router();

router.post('/surface-normal', TerrainController.getSurfaceNormal);
router.post('/horizon', TerrainController.getHorizonProfile);
router.post('/horizon-at-azimuth', TerrainController.getHorizonAtAzimuth);
router.post('/visibility', TerrainController.evaluateVisibility);
router.post('/subgrid', TerrainController.getTerrainSubgrid);

export default router;
