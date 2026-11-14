import { Router } from 'express';
import { SitesController } from '../controllers/sites.controller';

const router = Router();

router.get('/', SitesController.getDefaultSites);
router.get('/default', SitesController.getDefaultSites);
router.get('/defaults', SitesController.getDefaultSites);
router.post('/validate', SitesController.validateSite);
router.post('/compare', SitesController.compareSites);

export default router;
