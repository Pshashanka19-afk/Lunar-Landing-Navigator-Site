import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import { requestIdMiddleware } from './middleware/request-id';
import { httpLogger } from './middleware/logger';
import { notFoundHandler } from './middleware/not-found';
import { errorHandler } from './middleware/error-handler';

import healthRoutes from './routes/health.routes';
import sitesRoutes from './routes/sites.routes';
import geometryRoutes from './routes/geometry.routes';
import terrainRoutes from './routes/terrain.routes';
import illuminationRoutes from './routes/illumination.routes';
import windowsRoutes from './routes/windows.routes';
import seriesRoutes from './routes/series.routes';
import testRoutes from './routes/test.routes';
import trekRoutes from './routes/trek.routes';

export function createApp(): Express {
  const app = express();

  // Middleware pipeline
  app.use(requestIdMiddleware);
  app.use(httpLogger);

  const corsOrigin = env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim());
  app.use(
    cors({
      origin: corsOrigin,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Serve static files for frontend if available
  const staticCandidates = [
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/public'),
    path.resolve(process.cwd(), '../frontend/public'),
    path.resolve(__dirname, '../../frontend/public'),
  ];
  for (const cand of staticCandidates) {
    if (fs.existsSync(cand)) {
      app.use(express.static(cand));
    }
  }

  // Versioned API routes
  const prefix = env.API_PREFIX;
  app.use(prefix, healthRoutes);
  app.use(`${prefix}/sites`, sitesRoutes);
  app.use(`${prefix}/geometry`, geometryRoutes);
  app.use(`${prefix}/terrain`, terrainRoutes);
  app.use(`${prefix}/illumination`, illuminationRoutes);
  app.use(`${prefix}/windows`, windowsRoutes);
  app.use(`${prefix}/series`, seriesRoutes);
  app.use(`${prefix}/trek`, trekRoutes);
  app.use('/api/trek', trekRoutes);

  // Dedicated Test Lab Endpoints (available at both /api/test and /api/v1/test)
  app.use('/api/test', testRoutes);
  app.use(`${prefix}/test`, testRoutes);

  // SPA Catch-All fallback for client-side routing (serves index.html for non-API GET requests)
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith(prefix)) {
      return next();
    }
    const indexCandidates = [
      path.resolve(process.cwd(), 'frontend/dist/index.html'),
      path.resolve(process.cwd(), '../frontend/dist/index.html'),
      path.resolve(__dirname, '../../frontend/dist/index.html'),
    ];
    for (const indexFile of indexCandidates) {
      if (fs.existsSync(indexFile)) {
        return res.sendFile(indexFile);
      }
    }
    next();
  });

  // Catch-all 404 and centralized error handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
