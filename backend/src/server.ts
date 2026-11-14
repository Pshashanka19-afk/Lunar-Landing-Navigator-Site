import { app } from './app';
import { env } from './config/env';
import { logger } from './middleware/logger';
import { EphemerisFactory } from './services/ephemeris/ephemeris.factory';
import { DemFactory } from './services/terrain/dem.factory';

async function startServer(): Promise<void> {
  const port = env.PORT;

  const server = app.listen(port, async () => {
    logger.info(`================================================================`);
    logger.info(`  NASA Space Apps CLPS Lunar Mission Browser Backend Service   `);
    logger.info(`================================================================`);
    logger.info(`Server listening on http://localhost:${port}`);
    logger.info(`API Base URL: http://localhost:${port}${env.API_PREFIX}`);
    logger.info(`Environment: ${env.NODE_ENV}`);

    // Check and log scientific resource readiness
    try {
      const ephemProvider = EphemerisFactory.getProvider();
      const ephemReadiness = await ephemProvider.getReadinessDetails();

      const demService = DemFactory.getGeoTiffService();
      const demGeoTiffReady = await demService.isReady();

      logger.info(`----------------------------------------------------------------`);
      logger.info(`  Scientific Resources Status Report:                          `);
      logger.info(`----------------------------------------------------------------`);
      logger.info(`  Configured Ephemeris Provider: ${env.EPHEMERIS_PROVIDER}`);
      logger.info(`  Active Ephemeris Provider: ${ephemProvider.name}`);
      logger.info(`  Ephemeris Status: ${ephemReadiness.message}`);
      logger.info(`  Configured DEM Provider: ${env.DEM_PROVIDER}`);
      logger.info(
        `  DEM GeoTIFF Status: ${
          demGeoTiffReady
            ? 'MOUNTED & READY'
            : env.DEM_PROVIDER === 'synthetic'
            ? 'SYNTHETIC FIXTURE ACTIVE'
            : 'UNAVAILABLE (Mount LOLA GeoTIFF at DEM_PATH or set DEM_PROVIDER=synthetic)'
        }`
      );
      logger.info(`================================================================`);
    } catch (err) {
      logger.warn({ err }, 'Failed to inspect scientific resources at startup');
    }
  });

  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed. Exiting process.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error({ err }, 'Fatal error during server startup');
  process.exit(1);
});
