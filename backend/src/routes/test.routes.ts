import { Router } from 'express';
import { TestController } from '../controllers/test.controller';

const router = Router();

// Test Endpoints matching the exact specifications
router.get('/health', TestController.getHealth);
router.get('/data-status', TestController.getDataStatus);
router.get('/sites', TestController.getCuratedSites);
router.post('/site-analysis', TestController.postSiteAnalysis);
router.post('/compare-sites', TestController.postCompareSites);
router.post('/time-analysis', TestController.postTimeAnalysis);
router.post('/sun-earth-position', TestController.postSunEarthPosition);
router.post('/mission-assessment', TestController.postMissionAssessment);
router.post('/terrain', TestController.postTerrain);
router.post('/timeline', TestController.postTimeline);
router.get('/logs', TestController.getLogs);

export default router;

