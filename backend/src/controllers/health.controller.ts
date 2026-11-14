import { Request, Response, NextFunction } from 'express';
import { EphemerisFactory } from '../services/ephemeris/ephemeris.factory';
import { DemFactory } from '../services/terrain/dem.factory';
import { env } from '../config/env';

export class HealthController {
  public static async getHealth(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        status: 'UP',
        service: 'CLPS Lunar Mission Browser Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
      },
    });
  }

  public static async getScienceHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const spiceProvider = EphemerisFactory.getSpiceProvider();
      const analyticalProvider = EphemerisFactory.getAnalyticalProvider();
      const spiceReadiness = await spiceProvider.getReadinessDetails();
      const analyticalReadiness = await analyticalProvider.getReadinessDetails();

      const activeEphemeris = EphemerisFactory.getProvider();
      const demService = DemFactory.getGeoTiffService();
      const isDemGeoTiffReady = await demService.isReady();

      let demMeta = null;
      if (isDemGeoTiffReady) {
        demMeta = await demService.getMetadata();
      } else if (env.DEM_PROVIDER === 'synthetic') {
        const synthetic = DemFactory.getSyntheticFixture();
        demMeta = await synthetic.getMetadata();
      }

      const warnings: string[] = [];
      if (!spiceReadiness.ready && env.EPHEMERIS_PROVIDER === 'spice') {
        warnings.push('SPICE is configured as EPHEMERIS_PROVIDER but required kernels are missing in data/kernels.');
      }
      if (!isDemGeoTiffReady && env.DEM_PROVIDER === 'geotiff') {
        warnings.push('GeoTIFF is configured as DEM_PROVIDER but no GeoTIFF was found at DEM_PATH.');
      }
      if (env.DEM_PROVIDER === 'synthetic') {
        warnings.push('DEM_PROVIDER is set to synthetic fixture mode. Real lunar terrain is NOT being used.');
      }

      let operationalMode = 'EPHEMERIS_ONLY_DEM_CONFIG_REQUIRED';
      if (spiceReadiness.ready && isDemGeoTiffReady) {
        operationalMode = 'REAL_SPICE_AND_GEOTIFF';
      } else if (analyticalReadiness.ready && isDemGeoTiffReady) {
        operationalMode = 'ANALYTICAL_WITH_GEOTIFF';
      } else if (env.DEM_PROVIDER === 'synthetic') {
        operationalMode = 'ANALYTICAL_WITH_SYNTHETIC';
      }

      res.json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          configuredEphemerisProvider: env.EPHEMERIS_PROVIDER,
          configuredDemProvider: env.DEM_PROVIDER,
          ephemeris: {
            activeDefaultProvider: activeEphemeris.name,
            isRealSpice: spiceReadiness.ready,
            spice: {
              ready: spiceReadiness.ready,
              message: spiceReadiness.message,
              availableKernelsCount: spiceReadiness.availableKernels.length,
              missingKernelsCount: spiceReadiness.missingKernels.length,
              missingKernels: spiceReadiness.missingKernels,
            },
            analytical: {
              ready: analyticalReadiness.ready,
              message: analyticalReadiness.message,
              model: 'IAU/Meeus High-Precision Reduction',
            },
          },
          terrainDem: {
            configuredProvider: env.DEM_PROVIDER,
            isRealGeoTiff: isDemGeoTiffReady,
            ready: isDemGeoTiffReady || env.DEM_PROVIDER === 'synthetic',
            datasetId: demMeta?.id ?? 'none',
            datasetSource: demMeta?.source ?? 'No GeoTIFF mounted at DEM_PATH',
            isSynthetic: demMeta?.type === 'SYNTHETIC_FIXTURE',
            crs: demMeta?.crs ?? 'N/A',
            resolutionMeters: demMeta?.effectiveResolutionMeters ?? null,
          },
          operationalMode,
          warnings,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
