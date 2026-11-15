import { Router } from 'express';
import { SitesController } from '../controllers/sites.controller';

const router = Router();

router.get('/', SitesController.getDefaultSites);
router.get('/default', SitesController.getDefaultSites);
router.get('/defaults', SitesController.getDefaultSites);
router.post('/validate', SitesController.validateSite);
router.post('/compare', SitesController.compareSites);
router.post('/analysis', SitesController.getSiteAnalysis);
router.post('/illumination/evaluate', SitesController.evaluateIllumination);
router.get('/candidate-sites', SitesController.getDefaultSites);
router.get('/:id', SitesController.getSiteById);

export default router;
