import { Request, Response, NextFunction } from 'express';
import {
  surfaceNormalRequestSchema,
  horizonProfileRequestSchema,
  horizonAtAzimuthRequestSchema,
  terrainVisibilityRequestSchema,
  terrainSubgridRequestSchema,
} from '../schemas/terrain.schema';
import { DemFactory } from '../services/terrain/dem.factory';
import { SurfaceNormalService } from '../services/terrain/surface-normal.service';
import { HorizonProfileService } from '../services/terrain/horizon-profile.service';
import { TerrainVisibilityService } from '../services/terrain/terrain-visibility.service';

export class TerrainController {
  public static async getSurfaceNormal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = surfaceNormalRequestSchema.parse(req.body);
      const demProvider = DemFactory.getDemProvider(parsed.demProvider);

      const result = await SurfaceNormalService.analyzeSurface(demProvider, {
        latitudeDeg: parsed.site.latitudeDeg,
        longitudeDeg: parsed.site.longitudeDeg,
        observerHeightMeters: parsed.site.observerHeightMeters,
        stepMeters: parsed.stepMeters,
        derivativeMethod: parsed.derivativeMethod,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getHorizonProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = horizonProfileRequestSchema.parse(req.body);
      const demProvider = DemFactory.getDemProvider(parsed.demProvider);

      const result = await HorizonProfileService.calculateHorizonProfile(demProvider, {
        latitudeDeg: parsed.site.latitudeDeg,
        longitudeDeg: parsed.site.longitudeDeg,
        observerHeightMeters: parsed.site.observerHeightMeters,
        searchRadiusMeters: parsed.searchRadiusMeters,
        azimuthStepDeg: parsed.azimuthStepDeg,
        radialStepMeters: parsed.radialStepMeters,
        includeLunarCurvature: parsed.includeLunarCurvature,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getHorizonAtAzimuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = horizonAtAzimuthRequestSchema.parse(req.body);
      const demProvider = DemFactory.getDemProvider(parsed.demProvider);

      const profile = await HorizonProfileService.calculateHorizonProfile(demProvider, {
        latitudeDeg: parsed.site.latitudeDeg,
        longitudeDeg: parsed.site.longitudeDeg,
        observerHeightMeters: parsed.site.observerHeightMeters,
        searchRadiusMeters: parsed.searchRadiusMeters,
        azimuthStepDeg: parsed.azimuthStepDeg,
        radialStepMeters: parsed.radialStepMeters,
      });

      const horizonElevationDeg = HorizonProfileService.interpolateHorizonAtAzimuth(
        profile.samples,
        parsed.azimuthDeg
      );

      res.json({
        success: true,
        data: {
          site: parsed.site,
          requestedAzimuthDeg: parsed.azimuthDeg,
          horizonElevationDeg,
          units: {
            angles: 'degrees',
          },
          demMetadata: profile.demMetadata,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async evaluateVisibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = terrainVisibilityRequestSchema.parse(req.body);
      const demProvider = DemFactory.getDemProvider(parsed.demProvider);

      const profile = await HorizonProfileService.calculateHorizonProfile(demProvider, {
        latitudeDeg: parsed.site.latitudeDeg,
        longitudeDeg: parsed.site.longitudeDeg,
        observerHeightMeters: parsed.site.observerHeightMeters,
        searchRadiusMeters: parsed.searchRadiusMeters,
        azimuthStepDeg: parsed.azimuthStepDeg,
      });

      const evalResult = TerrainVisibilityService.evaluateTargetVisibility(
        parsed.targetAzimuthDeg,
        parsed.targetElevationDeg,
        profile.samples,
        parsed.angularToleranceDeg
      );

      res.json({
        success: true,
        data: {
          site: parsed.site,
          evaluation: evalResult,
          demMetadata: profile.demMetadata,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getTerrainSubgrid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = terrainSubgridRequestSchema.parse(req.body);
      const demProvider = DemFactory.getDemProvider(parsed.demProvider);
      const { x: centerX, y: centerY } = demProvider.latLonToProjected(parsed.site.latitudeDeg, parsed.site.longitudeDeg);
      const isCovered = await demProvider.isPointCovered(centerX, centerY);

      if (!isCovered) {
        res.status(400).json({
          success: false,
          error: {
            code: 'OUT_OF_BOUNDS',
            message: `Selected coordinates (${parsed.site.latitudeDeg}°, ${parsed.site.longitudeDeg}°) fall outside the active South Pole DEM GeoTIFF bounds.`,
          },
        });
        return;
      }

      const subgrid = await demProvider.getTerrainSubgrid(centerX, centerY, parsed.radiusMeters, parsed.gridResolution);
      const centerElev = await demProvider.getElevationAt(centerX, centerY);

      res.json({
        success: true,
        data: {
          site: {
            ...parsed.site,
            centerElevationMeters: centerElev,
            projectedX: centerX,
            projectedY: centerY,
          },
          grid: subgrid,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
