import { Router } from 'express';
import { SeriesController } from '../controllers/series.controller';

const router = Router();

router.post('/site', SeriesController.getSiteSeries);

export default router;
