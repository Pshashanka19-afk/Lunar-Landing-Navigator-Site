import { Router } from 'express';
import { SitesController } from '../controllers/sites.controller';

const router = Router();

// Candidate sites endpoints as specified in NASA South Pole specification
router.get('/candidate-sites', SitesController.getCandidateSites);
router.get('/candidate-sites/:id', SitesController.getSiteById);

// Authoritative scientific illumination evaluation endpoint
router.post('/illumination/evaluate', SitesController.evaluateIllumination);

export default router;
