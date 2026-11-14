import { z } from 'zod';
import { landingSiteSchema } from './site.schema';

export const surfaceNormalRequestSchema = z.object({
  site: landingSiteSchema,
  stepMeters: z.number().positive().max(500.0).optional(),
  derivativeMethod: z.enum(['CENTRAL_DIFFERENCE', 'LOCAL_PLANE_FIT']).optional().default('CENTRAL_DIFFERENCE'),
  demProvider: z.enum(['geotiff', 'synthetic']).optional(),
});

export const horizonProfileRequestSchema = z.object({
  site: landingSiteSchema,
  searchRadiusMeters: z.number().min(50.0).max(100000.0).optional().default(1000.0),
  azimuthStepDeg: z.number().min(0.5).max(45.0).optional().default(5.0),
  radialStepMeters: z.number().min(1.0).max(1000.0).optional().default(30.0),
  includeLunarCurvature: z.boolean().optional().default(true),
  demProvider: z.enum(['geotiff', 'synthetic']).optional(),
});

export const horizonAtAzimuthRequestSchema = z.object({
  site: landingSiteSchema,
  azimuthDeg: z.number().min(0.0).max(360.0),
  searchRadiusMeters: z.number().min(50.0).max(100000.0).optional().default(1000.0),
  azimuthStepDeg: z.number().min(0.5).max(45.0).optional().default(5.0),
  radialStepMeters: z.number().min(1.0).max(1000.0).optional().default(30.0),
  demProvider: z.enum(['geotiff', 'synthetic']).optional(),
});

export const terrainVisibilityRequestSchema = z.object({
  site: landingSiteSchema,
  targetAzimuthDeg: z.number().min(0.0).max(360.0),
  targetElevationDeg: z.number().min(-90.0).max(90.0),
  angularToleranceDeg: z.number().nonnegative().max(5.0).optional().default(0.1),
  searchRadiusMeters: z.number().min(50.0).max(100000.0).optional().default(1000.0),
  azimuthStepDeg: z.number().min(0.5).max(45.0).optional().default(5.0),
  demProvider: z.enum(['geotiff', 'synthetic']).optional(),
});

export const terrainSubgridRequestSchema = z.object({
  site: landingSiteSchema,
  radiusMeters: z.number().min(100.0).max(50000.0).optional().default(2000.0),
  gridResolution: z.number().int().min(16).max(100).optional().default(64),
  demProvider: z.enum(['geotiff', 'synthetic']).optional(),
});

export type SurfaceNormalRequestInput = z.infer<typeof surfaceNormalRequestSchema>;
export type HorizonProfileRequestInput = z.infer<typeof horizonProfileRequestSchema>;
export type HorizonAtAzimuthRequestInput = z.infer<typeof horizonAtAzimuthRequestSchema>;
export type TerrainVisibilityRequestInput = z.infer<typeof terrainVisibilityRequestSchema>;
export type TerrainSubgridRequestInput = z.infer<typeof terrainSubgridRequestSchema>;
